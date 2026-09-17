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
- **Kart** (`.card`, `<button>`): üstte etiket + kod, büyük fiyat (`₺`), altında yön çipi + sparkline. Hover: 2px kalk. Seçili: `aria-pressed` + altın kenar.
- **Yön çipi** (`.chip`): SVG ok + `%±x,yz`. 2 haneye yuvarlanınca 0,00 ise **"değişim yok"** (nötr) — sıfır-yön yanılgısını önler.
- **Sparkline / detay grafiği**: gerçek `history`'den SVG, `vector-effect: non-scaling-stroke`. <2 nokta → grafik gizli, boş-durum notu.
- **Nabız**: canlı akışta `--up` nokta, 2.4s nabız (reduced-motion'da statik).

## Hareket (tek yetkili an)
Giriş: grup/detay `rise` (opacity + translateY, ease-out, stagger). Canlı değer değişince fiyatta 0.7s `flash-up/down`. Hepsi `prefers-reduced-motion` altında kapalı.

## Durumlar
loading (bağlanıyor) · live (canlı) · error (akış yok) · empty (yetersiz geçmiş) · hover · focus-visible (altın halka) · selected.

## Tarayıcı yüzeyleri
`::selection`, kaydırma çubuğu, `:focus-visible` halkası, bağlantı alt-çizgi ofseti — hepsi paletten.

## Veri
`data/prices.json` (geçmiş, GitHub Actions ~15dk) + canlı Frankfurter & gold-api (60sn). Kaynak/hesap `app.js` başındaki sabitlerde.

_Bitiş: mekanik dedektör temiz (`impeccable detect` → []); masaüstü 1440 + mobil 390 ekran incelemesi yapıldı. Alt-ajan finish-reviewer/documenter yerine bitiş yerinde yürütüldü (kişisel tek-sayfa statik pano; ikame belirtildi)._
