#!/usr/bin/env python3
"""
PIYASA fiyat scraper.
Doviz ve altin fiyatlarini ceker, prices.json'a snapshot ekler.
GitHub Actions'ta 15 dakikada bir calisir.

Kaynak stratejisi:
  - Doviz: Frankfurter (bedava, key yok) -> yedek: TCMB XML
  - Altin: ons altin (XAU) uzerinden gram altin hesaplama
           gram_altin_TRY = (ons_USD / 31.1035) * USD_TRY
"""

import json
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "prices.json")
HISTORY_LIMIT = 200  # her enstruman icin saklanacak snapshot sayisi (15dk*200 ~ 2 gun)
UA = {"User-Agent": "Mozilla/5.0 (compatible; PiyasaBot/1.0)"}
TROY_OUNCE_G = 31.1035  # 1 ons = 31.1035 gram


def http_get_json(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def http_get_text(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def fetch_fx():
    """USD, EUR, GBP -> TRY. Once Frankfurter, olmazsa TCMB."""
    # 1) Frankfurter
    try:
        data = http_get_json(
            "https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR,GBP"
        )
        usd_try = data["rates"]["TRY"]
        # EUR/GBP -> TRY cevrimi: base USD oldugu icin capraz hesap
        eur_try = usd_try / data["rates"]["EUR"]
        gbp_try = usd_try / data["rates"]["GBP"]
        return {
            "USD_TRY": round(usd_try, 4),
            "EUR_TRY": round(eur_try, 4),
            "GBP_TRY": round(gbp_try, 4),
        }, "frankfurter"
    except Exception as e:
        print(f"[fx] Frankfurter basarisiz: {e}", file=sys.stderr)

    # 2) TCMB yedek (gunluk kapanis)
    try:
        text = http_get_text("https://www.tcmb.gov.tr/kurlar/today.xml")
        root = ET.fromstring(text)
        out = {}
        for c in root.findall("Currency"):
            code = c.attrib.get("Kod")
            if code in ("USD", "EUR", "GBP"):
                sell = c.find("ForexSelling")
                if sell is not None and sell.text:
                    out[f"{code}_TRY"] = round(float(sell.text.replace(",", ".")), 4)
        if out:
            return out, "tcmb"
    except Exception as e:
        print(f"[fx] TCMB basarisiz: {e}", file=sys.stderr)

    return None, None


def fetch_gold(usd_try):
    """Ons altin (USD) -> gram/ceyrek/tam altin TRY.
    Kaynak: metals.dev veya benzeri bedava ons kaynagi.
    usd_try elde yoksa altin hesaplanamaz."""
    if not usd_try:
        return None, None

    ons_usd = None
    source = None

    # Bedava ons altin kaynagi denemesi (gold-api gibi)
    for url, extractor, name in [
        ("https://api.gold-api.com/price/XAU", lambda d: d.get("price"), "gold-api"),
    ]:
        try:
            d = http_get_json(url)
            val = extractor(d)
            if val:
                ons_usd = float(val)
                source = name
                break
        except Exception as e:
            print(f"[gold] {name} basarisiz: {e}", file=sys.stderr)

    if not ons_usd:
        return None, None

    gram_try = (ons_usd / TROY_OUNCE_G) * usd_try
    return {
        # ceyrek/tam altin milyem (0.916) ve gramaj carpanlariyla yaklasik
        "GRAM_ALTIN": round(gram_try, 2),
        "CEYREK_ALTIN": round(gram_try * 1.75 * 0.916, 2),  # ~1.75g, 22 ayar
        "TAM_ALTIN": round(gram_try * 7.0 * 0.916, 2),      # ~7g, 22 ayar
    }, source


def load_existing():
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"version": 0, "instruments": {}}


def main():
    now = datetime.now(timezone.utc)
    ts = now.isoformat()

    fx, fx_src = fetch_fx()
    if not fx:
        print("HATA: doviz verisi alinamadi, cikiliyor.", file=sys.stderr)
        sys.exit(1)

    gold, gold_src = fetch_gold(fx.get("USD_TRY"))

    # Tum guncel fiyatlar
    current = dict(fx)
    if gold:
        current.update(gold)

    store = load_existing()
    instruments = store.setdefault("instruments", {})

    for code, price in current.items():
        inst = instruments.setdefault(code, {"history": []})
        hist = inst["history"]
        prev = hist[-1]["value"] if hist else None
        inst["current"] = price
        inst["previous"] = prev
        inst["change"] = round(price - prev, 4) if prev is not None else 0
        inst["change_pct"] = round((price - prev) / prev * 100, 2) if prev else 0
        hist.append({"t": ts, "value": price})
        # gecmisi sinirla
        inst["history"] = hist[-HISTORY_LIMIT:]

    store["version"] = store.get("version", 0) + 1
    store["updated_at"] = ts
    store["sources"] = {"fx": fx_src, "gold": gold_src}

    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)

    print(f"OK v{store['version']} @ {ts}")
    print(f"  doviz kaynak: {fx_src}, altin kaynak: {gold_src}")
    for code, price in current.items():
        print(f"  {code}: {price}")


if __name__ == "__main__":
    main()
