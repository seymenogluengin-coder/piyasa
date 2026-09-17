# DESIGN.md — PIYASA panosu

_Built world (index.html + styles.css + app.js). Operate modu; kod-led build._

## Dünya
Sakin bir **piyasa terminali**: derin mürekkep zemin, hassas tablo rakamları, saç-teli
ayraçlar. Neon-parıltılı kripto panosunu ve jenerik ikon-kart ızgarasını reddeder.

## Token'lar
- Zemin: `--ink #0b0f15` (üstte hafif radyal `#101724`), kart yüzeyi `--raise #131a26` → `--raise-2 #172030` (dikey degrade).
- Metin: `--text #e8edf4`, ikincil `--dim #9aa6b8`, en sönük `--faint #8792a4` (WCAG AA ≥4.5:1 doğrulandı).
- Semantik: artış `--up #46b98a`, azalış `--down #e5595b` — yalnız metin + yumuşak çip zemini, **glow yok**.
- Vurgu: `--gold #d9a441` yalnız **Altın** grubu başlığı, canlı nabız ve seçili kart.
- Ayraç: `--hair rgba(255,255,255,.075)` (1px); gölge offset + blur (`--shadow`), sıfır-offset halo yok.
- Yarıçap 14px; kolay-çıkış `--ease-out cubic-bezier(.16,1,.3,1)`.

## Tipografi
Sistem sans stack; **`font-variant-numeric: tabular-nums`** her yerde. Fiyat büyük, `letter-spacing -0.02em`. Etiketler küçük-kapital, harf aralıklı.

## Bileşenler
- **Hero — öne çıkanlar** (`.hero`, iki `.hero__panel`): sahnenin çapası. **Dolar** ve **Gram Altın** her zaman büyük fiyat + her zaman açık alan grafiğiyle üstte durur; masaüstünde yan yana, ≤640px alt alta. Gram Altın paneli altın etiket + altın-yumuşak kenar taşır. Grafik `series()`'ten çizilir; rengi çiple aynı yönden gelir.
- **Kart** (`.card`, `<button>`): üstte etiket + kod, büyük fiyat (`₺`), altında yön çipi + sparkline. Hover: 2px kalk. Seçili: `aria-pressed` + altın kenar. Bir karta tıklanınca ızgaranın altında tam-genişlik detay grafiği açılır (`detailOpen`; açılışta gizli).
- **Yön çipi** (`.chip`): SVG ok + `%±x,yz`. 2 haneye yuvarlanınca 0,00 ise **"değişim yok"** (nötr) — sıfır-yön yanılgısını önler. Yön tek kaynaktan: `chipDir(pct)`.
- **Grafik serisi** (`series()`): `history` + (varsa) canlı son nokta. Böylece grafiğin bitiş noktası ve rengi hep büyük fiyat/çiple aynı yönü gösterir — yeşil çip + kırmızı çizgi çelişkisi olmaz. `vector-effect: non-scaling-stroke`. <2 nokta → boş-durum notu.
- **Sparkline / detay grafiği**: aynı `series()`'ten SVG. Detay grafiği eksenli ve tıklamayla açılır.
- **Nabız**: canlı akışta `--up` nokta, 2.4s nabız (reduced-motion'da statik).

## Hareket (tek yetkili an)
- **Hero grafiği çizimi:** açılışta bir kez, çizgi soldan sağa (`.hero__chart--intro`, `stroke-dashoffset 1→0`, 0.9s ease-out, 0.25s gecikme; alan opaklığı 0.6s ile açılır). Canlı yeniden çizimde `--intro` verilmez → **tekrar oynamaz**.
- **Giriş:** `.hero`/`.group`/`.detail` `rise` (opacity + translateY, ease-out, kademeli).
- **Canlı değer:** fiyatta 0.7s `flash-up/down` renk geçişi (hero + kart).
- Hepsi `prefers-reduced-motion` altında kapalı.

## Durumlar
loading (bağlanıyor) · live (canlı) · error (akış yok) · empty (yetersiz geçmiş) · hover · focus-visible (altın halka) · selected.

## Tarayıcı yüzeyleri
`::selection`, kaydırma çubuğu, `:focus-visible` halkası, bağlantı alt-çizgi ofseti — hepsi paletten.

## Veri
`data/prices.json` (geçmiş, GitHub Actions ~15dk) + canlı Frankfurter & gold-api (60sn). Kaynak/hesap `app.js` başındaki sabitlerde.

_Bitiş: mekanik dedektör temiz (`impeccable detect` → []); masaüstü 1440 + mobil 390 ekran incelemesi yapıldı. Alt-ajan finish-reviewer/documenter yerine bitiş yerinde yürütüldü (kişisel tek-sayfa statik pano; ikame belirtildi)._
