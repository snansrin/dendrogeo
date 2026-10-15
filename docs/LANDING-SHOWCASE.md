# Ana sayfa tanıtım vitrini

Üst slider'ın HTML kaynağı `partials/landing.html`, stilleri `css/landing.css`, dokunma/klavye/ok gezinmesi `src/ui/landing-showcase.js` ve çevirileri mevcut `src/config/i18n-en.js` modülündedir. `index.html` ve runtime paketi `npm run build` ile üretilir. Slaytlar kendiliğinden ilerlemez; kullanıcı oklar, konu düğmeleri veya doğal yatay kaydırma ile gezer. Hareket azaltma tercihi korunur. Kayıt dosyası ve örnek uygulama yalnız ilgili bağlantı açıldığında yüklenir; üst slider yalnız JPEG görsellerini tembel yükler.

## Gerçek kayıt ve görseller

Gösterilen park Göksu Parkı, Ankara, Türkiye (`way/423602737`). Salt okunur örnek, 14 Ekim 2026 19:03:34 UTC tarihinde kullanıcı tarafından kabul edilen revizyon 26'nın kişisel veri içermeyen kopyasıdır. Kaynakta bina, sert zemin, su, yeşil alan ve çıplak zemin geometrileri bulunur. Haritada kabul edilmiş görsel geometri kullanılır; sınıf alanları kayıtlı sayılardan alınır. Hesap/owner kimliği, oturum bilgileri, ölçüm fotoğrafları veya kişi konumları yayımlanan örneğe dahil edilmez.

`assets/landing/goksu-example.json` görsel geometriyi, alanları, kaynak tarihlerini ve sahne kimliklerini taşır. Koordinatlar yalnız görüntüleme kopyasında altı ondalığa yuvarlanır. Bilimsel kaynak kayıt değiştirilmez. `ornekler/goksu-parki/` sayfası gerçek kayıtla, mevcut üretim alan çubuklarını, kabul edilmiş rapor sunumunu, harita araç rayını, çizim menüsünü ve şekil geometrisi modüllerini kullanır. JPEG dosyaları bu salt okunur gerçek veri sayfasının tarayıcı görüntüleridir; oturum açılmış canlı kullanıcı ekranı veya bağımsız bilimsel doğrulama olarak tanıtılmaz.

## Durumun doğru sunulması

Kullanıcı kabulü bağımsız bir doğruluk kampanyası anlamına gelmez. Gösterilen rapor, gerçek yüzey kaydının açıkça etiketlenmiş yayımlanmamış önizlemesidir; DGR kimliği/DOI uydurulmaz. Kontrolde aktif yayımlanmış park raporu bulunmadığı için geri çekilmiş yayınlar vitrine geçerli rapor olarak konmaz. Kayıtlı NDVI hücre gözlemleri mevcut olmadığında görünüm bunu belirtir ve yoğunluk renkleri üretmez. Ayrı bir gerçek uydu edinimi tamamlanırsa bunun dönemi/sahne kimlikleri ve kayıttan farklı edinim tarihi ayrıca tutulur.

Çizim örneği bellekte geçicidir; park sınırına kırpma mevcut geometri modülünü kullanır. Sunucuya veya kabul edilmiş kayda yazmaz. Yüzey motoru, bilimsel katsayılar, veri erişim kapıları ve kabul edilmiş sonuçlar bu vitrin çalışmasında değiştirilmez.
