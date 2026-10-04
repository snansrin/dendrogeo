# Tek yüzey analiz motoru ve fırça düzeltmesi

## Sorun ve karar

Önceki akış üç farklı işlemi birleştiriyordu: ESA WorldCover sınıfları, OSM ile hücrelerin su/yol olarak yeniden etiketlenmesi ve Sentinel-2 spektral eşikleri. Son işlem, görüntü tarihi ve eşiklere bağlı olarak büyük yeşil alanları sert zemin olarak değiştirebiliyordu. Ayrıca OSM ile değiştirilmiş sonuç “ham raster” başlığı altında gösteriliyor; tarama veya düzeltme olmadan kabul engelleniyordu.

Yeni otomatik analiz yalnız ESA WorldCover 2021 v200 kullanır. IO çapraz rasterı, Sentinel-2 yeniden sınıflandırması ve OSM hücre yeniden etiketlemesi bu akışta çalışmaz. Park/hücre kesişim hesabı, alan QA kontrolü ve ham kaynak kodları korunur. OSM nesne sınırları yalnız kullanıcının açtığı ayrı bir vektör düzeltme katmanıdır; yeni taslaklarda kapalıdır. Önceden kabul edilmiş hesap kayıtları ve yayımlanmış raporlar kendiliğinden değiştirilmez.

## Kullanım

- Ek tarama yapmadan ham analizi inceleyip kabul etmek mümkündür.
- “Ham analizi göster” kaynak sınıflarını gösterir; “Düzenlemeye dön” mevcut düzeltmeleri geri getirir. Bu karşılaştırma kayıtları silmez. Ham karşılaştırma görünümünde kabul engellenir; düzenleme görünümünde değişiklik yapılmamış raster da kabul edilebilir.
- Fırça sınıfı ve 5, 10, 20 veya 40 metre çap seçilir. Basılı tutup sürükleyerek çizilen iz, bırakıldığında tek düzeltme olarak işlenir. İz park sınırına kırpılır, park delikleri dışarıda kalır ve ara pointer olayları arasındaki yol da boyanır.
- Son fırça izi tek hamlede geri alınır. Fırça kapatılınca harita sürükleme geri gelir. Konum/park değişimi, pointer iptali ve harita kapanışı yarım kalan izleri kaydetmez.
- Alan özeti, GeoJSON, PNG ve kabul edilen rapor geometrisi aynı kesin düzeltme geometrisini kullanır. Kaynak hücre kodları değiştirilmez. Fırça yöntemi `visual-brush` olarak kaydedilir.

## Gerçek veri kontrolleri

Nominatim üzerinden alınan gerçek OSM park sınırları ve canlı ESA COG verisiyle aşağıdaki sonuçlar elde edildi. Süreler bu oturumun bağlantısına aittir; saha bağlantısının hız garantisi değildir. Her analiz dört veri isteği kullandı ve alan QA kontrolünü geçti.

| Park | Hücre | Analiz alanı (ha) | Yeşil (ha) | Su (ha) | Sert (ha) | Çıplak (ha) | Alan farkı | Süre |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Göksu Parkı | 7.864 | 50,013 | 22,216 | 12,503 | 14,717 | 0,577 | %0,196 | 13,7 sn |
| Başkent Millet Bahçesi | 8.919 | 56,772 | 43,122 | 0,487 | 4,697 | 8,466 | %0,198 | 10,8 sn |
| Kuğulu Park | 210 | 1,175 | 0,900 | 0,000 | 0,275 | 0,000 | %0,199 | 11,7 sn |

Bu tablo geometrik/teknik çalışma kontrolüdür; bağımsız saha doğruluk ölçümü değildir. Özellikle Kuğulu Park'taki küçük havuz rasterda ayrı su hücresi üretmemiştir. ESA 2021 verisi güncel yüzey değişikliklerini veya 10 m altındaki nesneleri eksiksiz göstermeyi garanti etmez. Önceki OSM ile değiştirilmiş “ham” özetle yeni gerçek ham rasterın aynı olması beklenmez. Kullanıcının görsel düzeltmesi bir saha/harita değerlendirmesi olarak açıkça ayrı tutulur; alanlar hedef değere zorlanmaz.

Kaynak: [ESA WorldCover veri açıklaması](https://esa-worldcover.org/en/data-access), [2021 v200 ürün kılavuzu](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf).

Telefon kontrolleri: 360/390/430 px yatay taşma yok; gerçek 7.864 hücreli harita yaklaşık 1,5 sn içinde çizildi. Gerçek pointer sürüklemesi, 20 m fırça, ham/inceleme karşılaştırması, geri alma ve toplam alanın korunması kontrol edildi. Oturum koruması aşılmadı; gerçek kullanıcı hesabıyla saha testi yapılmadı.

Kurtarma çekirdeği `recovery/core-2026-10-04` bu değişikliklerden bağımsız olarak korunur. Önceki güvenlik denetimindeki canlı kanal yetkilendirmesi ve diğer açık işler bu düzeltmenin parçası değildir.

Doğrulama: `npm run check` başarılı; 1.240/1.240 test geçti. Üç parkın gerçek hücreleriyle telefon üzerinde pointer ve dokunmatik fırça, iptal, ham karşılaştırma ve geri alma doğrulandı. Yeni fırça geometrisinin cihaz/hesap kaydı yeniden yüklenirken korunması için regresyon testi eklendi.
