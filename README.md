# PIYASA — Fiyat Scraper + Canlı Fetch

Döviz ve altın fiyatları için **tamamen bedava, sunucusuz** veri altyapısı.

## Nasıl çalışır?

İki katman var:

| Katman | Ne yapar | Kaynak | Sıklık |
|--------|----------|--------|--------|
| **Snapshot** | Geçmiş grafik verisi üretir | GitHub Actions cron | ~15 dk |
| **Canlı** | Uygulama açıkken anlık fiyat | Uygulama içi fetch | 60 sn |

Snapshot, `data/prices.json`'a yazılır ve GitHub'a commit edilir. Uygulama bu dosyayı
raw URL'den çekip geçmiş grafiği çizer. Aynı anda uygulama, ekran açıkken doğrudan
canlı API'den anlık fiyatı çeker — böylece kullanıcı hem güncel fiyatı hem de gün içi
hareketi görür.

## Kurulum

1. Bu klasörü bir GitHub reposuna push et:
   ```bash
   git init && git add . && git commit -m "ilk kurulum"
   git branch -M main
   git remote add origin https://github.com/KULLANICI/REPO.git
   git push -u origin main
   ```

2. Repo → **Settings → Actions → General → Workflow permissions** →
   "Read and write permissions" seçili olsun (bot commit atabilsin diye).

3. **Actions** sekmesine git → "Fiyat Snapshot" workflow'unu bul →
   "Run workflow" ile elle bir kez tetikle. `data/prices.json` oluşacak.

4. Uygulama tarafında `app-integration/useLivePrices.ts` içindeki
   `SNAPSHOT_URL`'de `USER/REPO` kısmını kendi reponla değiştir.

## Kaynaklar (hepsi bedava, API key yok)

- **Döviz**: [Frankfurter](https://frankfurter.dev) → yedek: TCMB resmi XML
- **Altın**: ons altın (XAU) → gram/çeyrek/tam hesaplama

## Notlar

- GitHub Actions cron'u yoğun saatlerde birkaç dakika gecikebilir — "tam 15 dk" değil,
  "~15 dk" garantisi var. Fiyat takibi için fazlasıyla yeterli.
- Çeyrek/tam altın, gram üzerinden yaklaşık (22 ayar, standart gramaj) hesaplanır.
  Kuyumcu alış-satış farkını yansıtmaz; referans fiyattır.
- Public repoda Actions bedava (aylık dakika limiti pratikte yeterli).
  Private repoda aylık ücretsiz Actions dakikası sınırına dikkat et.
