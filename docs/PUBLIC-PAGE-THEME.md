# Kamu sayfalarının tema mimarisi

Bilgi sayfaları, rapor dizini ve geri çekme bildirimleri uygulamanın mevcut
`DG_APPEARANCE` modüllerini ve `dg_appearance` cihaz tercihini kullanır.
Yeni bir tercih deposu veya hesap ayarı oluşturulmaz.

- `scripts/lib/public-page-theme.mjs`: ortak kaynak ve tema bağlantıları.
- `scripts/sync-public-page-themes.mjs`: kamu HTML sayfalarını eşitler; `build`
  üretir, `build:check` eksik bağlantıyı reddeder.
- `assets/public-pages/appearance.js`: mevcut `dg-switch` denetimini ve
  erişilebilir yatay tablo kaydırmasını bağlar.
- `assets/public-pages/style.css`: mevcut font ve renk değişkenleriyle belge sunumu.

Yayımlanmış DGR `index.html` dosyaları manifest hash'inin parçasıdır. Bu
dosyalar tema eşitlemesinden hariç tutulur. `/rapor/gorunum/?id=DGR-YYYY-NNNN`
okuyucusu orijinal belgeyi aynı kökenli bir çerçevede açar, yalnız ekran
stillerini ekler ve üst sayfanın temasını izler. Orijinal içerik doğrulaması
çalışmaya devam eder. PDF, veri dosyaları, kalıcı bağlantı ve baskı biçimi korunur.

`scripts/public-page-theme-smoke.mjs`, 360/390/430 piksel görünümünde tema
kalıcılığını, kaydırmayı, açık/koyu kontrastını, okuyucu bütünlük göstergesini ve
rapor manifestlerindeki dosya hash'lerini doğrular. Telefon CI zincirine dahildir.
