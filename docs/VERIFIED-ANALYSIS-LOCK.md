# Kullanıcı tarafından doğrulanan yüzey analizi kilidi

8 Ekim 2026 tarihinde kullanıcı Chrome normal/gizli sekme ve otomatik tarama düzeltmelerinden sonra sonucu onayladı ve bu sonucu sağlayan bileşenlerin değiştirilmemesini istedi.

- Çalışan sürüm: `90f0b0a2aa80cf684de8fc45e0a37fb3dbd97807` (PR #67).
- Tam kilitli yayın yedeği: `recovery/locked-release-20261008r88`.
- Motorun önceki geri dönüş dalı: `recovery/verified-analysis-2026-10-08` — bu commit.
- Kilit manifesti: `docs/verified-analysis-lock.json`, 31 dosyanın SHA-256 özeti.
- Denetim: `npm run check:analysis-lock`; tam kontrolde ve CI'da zorunlu çalışır.

Kullanıcının sonraki açık talimatıyla yalnız yayın sürümü `20261008r88` ve Service Worker r88 olarak yenilendi. Analiz motoru ve yüzey sonuçlarını üreten kaynaklar aynı kaldı. JS/CSS URL'leri yayın sürümü + içerik hash'i içerir; tembel modüller ve geometri worker'ı da aynı yayın sürümünü kullanır. `release-version.json` ilerideki açıkça istenmiş önbellek yenilemeleri için ayrı tutulur.

## Korunan bileşenler

| Bileşen | Korunan davranış |
|---|---|
| ESA WorldCover, raster motoru ve koordinat dönüşümleri | Gerçek hücre–park kesişimi ve alan QA; hedef alana zorlamama |
| Sentinel-2, STAC ve COG erişimi | Güncel dönem taraması, veri kalitesi, sınırlı yeniden deneme |
| Overpass ve park sorguları | Güncel park nesneleri, su/havuz ve bina geometrileri |
| Yüzey incelemesi ve geometri worker'ı | Kesin kesişim, sınıf öncelikleri, kullanıcı kararları, alan korunumu |
| Yüzey Analizi düğmesi ve inceleme paneli | Her açılışta tek otomatik tarama; tarama bitmeden başarı bildirmeme; eski cihaz maskesini güncel OSM verisiyle yeniden oluşturma |
| Harita ve dışa aktarma | Aynı kesin geometri; kabul edilmiş anlık görüntüyü koruma |
| Tembel modül yükleme, GeoTIFF, polygon-clipping | Aynı yükleme zinciri ve bağımlılık sürümleri |
| Service Worker | r88 uygulama önbelleği ve HTTP yeniden doğrulaması; çevrimdışı yedek |
| İlgili regresyon testleri | Motor, tarama, maske ve önbellek kontrollerinin korunması |

Manifest değişikliği de denetlenir. Korunan bir dosyada tek bayt değişiklik veya dosya silinmesi kontrolü başarısız yapar. Arayüz düzenlemesi isteği bu dosyalarda değişiklik izni sayılmaz; kilidi açmak için kullanıcıdan açık talimat gerekir. Hash'leri yenileyerek, kilit adımını kaldırarak veya testleri değiştirerek kontrol aşılmaz.

Bu koruma geliştirici talimatı ve CI denetimidir. Depo sahibi/yönetici GitHub ayarlarını veya denetim kodunu değiştirebilir; mevcut bağlantı GitHub branch-protection yönetim yetkisi sağlamadığından sunucu tarafında mutlak değişmezlik sağlandığı iddia edilmez. Dış veri sağlayıcılarının içerik ve erişilebilirliği bu kod kilidiyle sabitlenmez.

## Açıkça onaylanmış ilerideki değişiklik

Kullanıcı kilitli kapsam için açıkça değişiklik isterse, önce bu commit ve geri dönüş dalı korunur. Değişiklik ayrı dalda değerlendirilir; ilgili regresyonlar, tam kontrol, telefon görünümü ve Göksu/Başkent Millet Bahçesi/Kuğulu Park canlı QA geçmeden kilit tabanı güncellenmez. Eski anlık görüntüler ve raporlar değiştirilmez. Otomatik hash yenileme komutu bulunmaz.
