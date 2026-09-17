/**
 * useLivePrices — Uygulama ici CANLI fiyat + gecmis grafik.
 *
 * Iki katmanli mimari:
 *  1) SNAPSHOT (gecmis grafik):  GitHub raw'dan prices.json cekilir.
 *     GitHub Actions 15 dk'da bir gunceller. Gecmis noktalar buradan gelir.
 *  2) CANLI (uygulama acikken):  Dogrudan bedava API'den anlik fiyat cekilir,
 *     ekran acikken periyodik yenilenir. "Su anki fiyat" hissi buradan gelir.
 *
 * Ikisi de tamamen bedava, sunucu yok.
 */

import { useEffect, useState, useCallback, useRef } from "react";

// --- 1) Snapshot kaynagi (gecmis grafik icin) ---
// GitHub'a push ettikten sonra {user}/{repo} kismini kendi repo'nla degistir.
const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/USER/REPO/main/data/prices.json";

// --- 2) Canli kaynak (uygulama acikken anlik fiyat) ---
const LIVE_FX_URL =
  "https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR,GBP";
const LIVE_GOLD_URL = "https://api.gold-api.com/price/XAU";
const TROY_OUNCE_G = 31.1035;

const LIVE_REFRESH_MS = 60_000; // ekran acikken 60 sn'de bir canli yenile

export interface Instrument {
  current: number;
  previous: number | null;
  change: number;
  change_pct: number;
  history: { t: string; value: number }[];
}

export interface PriceStore {
  version: number;
  updated_at: string;
  instruments: Record<string, Instrument>;
}

async function fetchSnapshot(): Promise<PriceStore | null> {
  try {
    // cache kirici query param - GitHub raw CDN'i bayat vermesin
    const res = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`snapshot ${res.status}`);
    return (await res.json()) as PriceStore;
  } catch (e) {
    console.warn("[prices] snapshot alinamadi:", e);
    return null;
  }
}

async function fetchLive(): Promise<Record<string, number> | null> {
  try {
    const fxRes = await fetch(LIVE_FX_URL);
    const fx = await fxRes.json();
    const usdTry: number = fx.rates.TRY;
    const out: Record<string, number> = {
      USD_TRY: +usdTry.toFixed(4),
      EUR_TRY: +(usdTry / fx.rates.EUR).toFixed(4),
      GBP_TRY: +(usdTry / fx.rates.GBP).toFixed(4),
    };
    try {
      const gRes = await fetch(LIVE_GOLD_URL);
      const g = await gRes.json();
      if (g?.price) {
        const gram = (Number(g.price) / TROY_OUNCE_G) * usdTry;
        out.GRAM_ALTIN = +gram.toFixed(2);
        out.CEYREK_ALTIN = +(gram * 1.75 * 0.916).toFixed(2);
        out.TAM_ALTIN = +(gram * 7.0 * 0.916).toFixed(2);
      }
    } catch (e) {
      console.warn("[prices] canli altin alinamadi:", e);
    }
    return out;
  } catch (e) {
    console.warn("[prices] canli doviz alinamadi:", e);
    return null;
  }
}

export function useLivePrices() {
  const [store, setStore] = useState<PriceStore | null>(null);
  const [live, setLive] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSnapshot = useCallback(async () => {
    const s = await fetchSnapshot();
    if (s) setStore(s);
    else setError("Gecmis veriler yuklenemedi");
  }, []);

  const refreshLive = useCallback(async () => {
    const l = await fetchLive();
    if (l) setLive(l);
  }, []);

  // ilk yukleme: snapshot + canli birlikte
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadSnapshot(), refreshLive()]);
      setLoading(false);
    })();
  }, [loadSnapshot, refreshLive]);

  // ekran acikken canli yenileme dongusu
  useEffect(() => {
    timer.current = setInterval(refreshLive, LIVE_REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refreshLive]);

  /**
   * Bir enstrumanin gosterilecek hali:
   *  - current: CANLI fiyat (varsa), yoksa snapshot current
   *  - history: snapshot'tan (gecmis grafik)
   *  - change: canli fiyat ile snapshot'taki gun baslangicini karsilastirir
   */
  const get = useCallback(
    (code: string) => {
      const snap = store?.instruments?.[code];
      const liveVal = live[code];
      const current = liveVal ?? snap?.current ?? null;
      const history = snap?.history ?? [];
      const dayStart = history.length ? history[0].value : snap?.previous ?? null;
      const change =
        current != null && dayStart != null ? +(current - dayStart).toFixed(4) : 0;
      const change_pct =
        current != null && dayStart ? +((change / dayStart) * 100).toFixed(2) : 0;
      return { current, history, change, change_pct, isLive: liveVal != null };
    },
    [store, live]
  );

  return {
    get,
    loading,
    error,
    updatedAt: store?.updated_at ?? null,
    refresh: async () => {
      await Promise.all([loadSnapshot(), refreshLive()]);
    },
  };
}
