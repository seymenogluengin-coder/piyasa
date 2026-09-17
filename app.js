/* PIYASA — canlı fiyat + geçmiş grafik. Sunucu yok, hepsi tarayıcıda. */
"use strict";

// --- Kaynaklar ---
const SNAPSHOT_URL = "data/prices.json"; // geçmiş grafik (GitHub Actions ~15dk)
const LIVE_FX_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR,GBP";
const LIVE_GOLD_URL = "https://api.gold-api.com/price/XAU";
const TROY_OUNCE_G = 31.1035;
const LIVE_REFRESH_MS = 60_000;

// --- Enstrümanlar ---
const INSTRUMENTS = [
  { code: "USD_TRY", label: "Dolar", sub: "USD", group: "doviz", min: 2, max: 2 },
  { code: "EUR_TRY", label: "Euro", sub: "EUR", group: "doviz", min: 2, max: 2 },
  { code: "GBP_TRY", label: "Sterlin", sub: "GBP", group: "doviz", min: 2, max: 2 },
  { code: "GRAM_ALTIN", label: "Gram Altın", sub: "XAU / g", group: "altin", min: 2, max: 2 },
  { code: "CEYREK_ALTIN", label: "Çeyrek Altın", sub: "22 ayar", group: "altin", min: 0, max: 0 },
  { code: "TAM_ALTIN", label: "Tam Altın", sub: "22 ayar", group: "altin", min: 0, max: 0 },
];
const BY_CODE = Object.fromEntries(INSTRUMENTS.map((i) => [i.code, i]));

// --- Durum ---
let store = null; // snapshot
let live = {}; // canlı currents
let selected = "USD_TRY";
const lastShown = {}; // parıltı için son gösterilen değer

// --- Yardımcılar ---
const $ = (sel) => document.querySelector(sel);

function fmt(code, v) {
  if (v == null || Number.isNaN(v)) return "—";
  const c = BY_CODE[code];
  return v.toLocaleString("tr-TR", {
    minimumFractionDigits: c.min,
    maximumFractionDigits: c.max,
  });
}

function fmtTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// Bir enstrümanın gösterilecek hali: canlı current + snapshot geçmişi.
function get(code) {
  const snap = store && store.instruments ? store.instruments[code] : null;
  const history = snap && snap.history ? snap.history : [];
  const current = live[code] != null ? live[code] : snap ? snap.current : null;
  const dayStart = history.length ? history[0].value : snap ? snap.previous : null;
  const change = current != null && dayStart != null ? current - dayStart : 0;
  const pct = current != null && dayStart ? (change / dayStart) * 100 : 0;
  return { current, history, change, pct, isLive: live[code] != null };
}

// --- Veri çekme ---
async function fetchSnapshot() {
  try {
    const r = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`snapshot ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn("[piyasa] snapshot alınamadı:", e);
    return null;
  }
}

async function fetchLive() {
  const out = {};
  const fx = await (await fetch(LIVE_FX_URL)).json();
  const usd = fx.rates.TRY;
  out.USD_TRY = usd;
  out.EUR_TRY = usd / fx.rates.EUR;
  out.GBP_TRY = usd / fx.rates.GBP;
  try {
    const g = await (await fetch(LIVE_GOLD_URL)).json();
    if (g && g.price) {
      const gram = (Number(g.price) / TROY_OUNCE_G) * usd;
      out.GRAM_ALTIN = gram;
      out.CEYREK_ALTIN = gram * 1.75 * 0.916;
      out.TAM_ALTIN = gram * 7.0 * 0.916;
    }
  } catch (e) {
    console.warn("[piyasa] canlı altın alınamadı:", e);
  }
  return out;
}

// --- SVG çizim ---
function sparkline(history, dir) {
  const vals = history.map((h) => h.value);
  if (vals.length < 2) return "";
  const w = 62, h = 24, p = 3;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => p + (i / (vals.length - 1)) * (w - 2 * p);
  const y = (v) => h - p - ((v - min) / span) * (h - 2 * p);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const stroke = dir > 0 ? "var(--up)" : dir < 0 ? "var(--down)" : "var(--faint)";
  const area = `M${x(0).toFixed(1)},${h - p} L${pts.join(" L")} L${x(vals.length - 1).toFixed(1)},${h - p} Z`;
  return `<svg class="card__spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${area}" fill="${stroke}" opacity="0.13" />
    <polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
  </svg>`;
}

function caret(dir) {
  if (dir > 0) return `<svg class="chip__ico" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9 8H1z" fill="currentColor"/></svg>`;
  if (dir < 0) return `<svg class="chip__ico" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5 1 2h8z" fill="currentColor"/></svg>`;
  return "";
}

function chipHTML(change, pct) {
  // Gösterilen 2 haneye yuvarlanır; yuvarlamada 0,00 çıkan hareketi nötr say
  // (tek snapshot varken canlı-snapshot mikro farkı yanıltıcı yön göstermesin).
  const p = Math.round(pct * 100) / 100;
  const dir = p > 0 ? 1 : p < 0 ? -1 : 0;
  const cls = dir > 0 ? "chip--up" : dir < 0 ? "chip--down" : "";
  const sign = p > 0 ? "+" : "";
  const body = dir === 0
    ? "değişim yok"
    : `${caret(dir)}<span>%${sign}${p.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
  return `<span class="chip ${cls}">${body}</span>`;
}

// --- Kart render ---
function cardHTML(inst) {
  const { current, history, change, pct } = get(inst.code);
  const dir = Math.sign(change);
  return `
    <button class="card" type="button" data-code="${inst.code}" aria-pressed="${selected === inst.code}">
      <span class="card__top">
        <span class="card__label">${inst.label}</span>
        <span class="card__sub">${inst.sub}</span>
      </span>
      <span class="card__price" data-price><span class="cur">₺</span>${fmt(inst.code, current)}</span>
      <span class="card__foot">
        ${chipHTML(change, pct)}
        ${sparkline(history, dir)}
      </span>
    </button>`;
}

function renderCards() {
  for (const grp of ["doviz", "altin"]) {
    const host = $(`#cards-${grp}`);
    host.innerHTML = INSTRUMENTS.filter((i) => i.group === grp).map(cardHTML).join("");
  }
  for (const btn of document.querySelectorAll(".card")) {
    btn.addEventListener("click", () => selectInstrument(btn.dataset.code));
  }
}

// --- Detay grafiği ---
function detailChart(history) {
  const vals = history.map((h) => h.value);
  if (vals.length < 2) {
    return `<p class="notice" style="margin:0">Geçmiş grafiği için henüz yeterli veri yok. İlk snapshot'lar biriktikçe burada eğilim çıkar.</p>`;
  }
  const W = 1000, H = 300, pl = 8, pr = 66, pt = 18, pb = 28;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => pl + (i / (vals.length - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - min) / span) * (H - pt - pb);
  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dir = Math.sign(vals[vals.length - 1] - vals[0]);
  const stroke = dir >= 0 ? "var(--up)" : "var(--down)";
  const area = `M${x(0).toFixed(1)},${(H - pb).toFixed(1)} L${line} L${x(vals.length - 1).toFixed(1)},${(H - pb).toFixed(1)} Z`;

  let grid = "";
  const rows = 3;
  for (let r = 0; r <= rows; r++) {
    const gv = min + (span * r) / rows;
    const gy = y(gv);
    grid += `<line class="grid-line" x1="${pl}" y1="${gy.toFixed(1)}" x2="${W - pr}" y2="${gy.toFixed(1)}" />
      <text class="axis-txt" x="${W - pr + 8}" y="${(gy + 4).toFixed(1)}">${fmt(selected, gv)}</text>`;
  }
  const tStart = fmtDate(history[0].t);
  const tEnd = fmtDate(history[history.length - 1].t);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${BY_CODE[selected].label} geçmiş fiyat grafiği">
    ${grid}
    <path class="price-area" d="${area}" fill="${stroke}" />
    <polyline class="price-line" points="${line}" stroke="${stroke}" />
    <text class="axis-txt" x="${pl}" y="${H - 8}">${tStart}</text>
    <text class="axis-txt" x="${W - pr}" y="${H - 8}" text-anchor="end">${tEnd}</text>
  </svg>`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function renderDetail() {
  const inst = BY_CODE[selected];
  const { current, history, change, pct } = get(selected);
  const dir = Math.round(pct * 100) / 100 > 0 ? 1 : Math.round(pct * 100) / 100 < 0 ? -1 : 0;
  $("#detail").hidden = false;
  $("#detail-sub").textContent = inst.sub;
  $("#detail-title").textContent = inst.label;
  $("#detail-price").innerHTML = `<span class="cur" style="color:var(--faint);font-size:.62em">₺</span>${fmt(selected, current)}`;
  $("#detail-chip").outerHTML = chipHTML(change, pct).replace('class="chip', 'id="detail-chip" class="chip');
  $("#chart-wrap").innerHTML = detailChart(history);
  if (history.length) {
    const vals = history.map((h) => h.value);
    $("#detail-meta").innerHTML =
      `<span>En düşük <b>₺${fmt(selected, Math.min(...vals))}</b></span>` +
      `<span>En yüksek <b>₺${fmt(selected, Math.max(...vals))}</b></span>` +
      `<span>Snapshot <b>${history.length}</b> nokta</span>` +
      `<span>Değişim <b style="color:${dir > 0 ? "var(--up)" : dir < 0 ? "var(--down)" : "inherit"}">${dir === 0 ? "yok" : (dir > 0 ? "+" : "") + fmt(selected, change)}</b></span>`;
  } else {
    $("#detail-meta").innerHTML = "";
  }
}

function selectInstrument(code) {
  selected = code;
  for (const btn of document.querySelectorAll(".card")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.code === code));
  }
  renderDetail();
}

// --- Canlı değeri kartlara yansıt + parıltı ---
function applyLiveToCards() {
  for (const inst of INSTRUMENTS) {
    const { current, change, pct } = get(inst.code);
    const btn = document.querySelector(`.card[data-code="${inst.code}"]`);
    if (!btn) continue;
    const priceEl = btn.querySelector("[data-price]");
    const prev = lastShown[inst.code];
    priceEl.innerHTML = `<span class="cur">₺</span>${fmt(inst.code, current)}`;
    btn.querySelector(".chip").outerHTML = chipHTML(change, pct);
    if (prev != null && current != null && current !== prev) {
      const cls = current > prev ? "flash-up" : "flash-down";
      priceEl.classList.remove("flash-up", "flash-down");
      void priceEl.offsetWidth; // reflow → animasyonu yeniden tetikle
      priceEl.classList.add(cls);
    }
    lastShown[inst.code] = current;
  }
}

function setStatus(state, text, iso) {
  $("#status").dataset.state = state;
  $("#pulse-text").textContent = text;
  if (iso !== undefined) {
    const el = $("#updated");
    el.textContent = fmtTime(iso);
    el.dateTime = iso || "";
  }
}

// --- Döngü ---
async function refreshLive() {
  try {
    live = await fetchLive();
    applyLiveToCards();
    if (selected) renderDetail();
    setStatus("live", "canlı", new Date().toISOString());
  } catch (e) {
    console.warn("[piyasa] canlı döviz alınamadı:", e);
    setStatus("error", "canlı akış yok", undefined);
  }
}

async function init() {
  renderCards(); // iskelet/mevcut snapshot yoksa boş kartlar
  store = await fetchSnapshot();
  if (store) {
    renderCards();
    for (const i of INSTRUMENTS) lastShown[i.code] = get(i.code).current;
    setStatus("loading", "bağlanıyor", store.updated_at);
  } else {
    $("#notice").hidden = false;
    $("#notice").textContent =
      "Geçmiş veri (data/prices.json) yüklenemedi. Canlı fiyatlar yine de çekilecek; grafik için snapshot gerekir.";
  }
  selectInstrument(selected);
  await refreshLive();
  setInterval(refreshLive, LIVE_REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshLive();
  });
}

init();
