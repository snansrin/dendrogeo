# DendroGeo — 10 m Arazi Örtüsü / 2020 Yöntemi

## 1. Amaç

DendroGeo park analizinde sınıflandırma sonucu seçilen park polygonu ile 10 m çözünürlüklü kategorik arazi örtüsü rasterının hücre-kesişimlerinden hesaplanır.

Sistem örnek nokta oranını alana çevirmez, her hücreyi körlemesine 100 m² kabul etmez ve eksik alanı başka sınıflara zorla dağıtmaz.

## 2. Veri kaynağı

Kaynak ürün: Impact Observatory · 10m Annual Land Use Land Cover (9-class) V2.

Ürün küresel yıllık 10 m arazi örtüsü haritalarını Cloud Optimized GeoTIFF (COG) biçiminde ve UTM kaynak karolarına hizalı olarak yayınlar. 2020 analizinde yalnızca gerekli veri karolarının data raster varlığı okunur. Lisans CC BY 4.0'dır.

Resmî kaynaklar:

- https://planetarycomputer.microsoft.com/dataset/io-lulc-annual-v02
- https://planetarycomputer.microsoft.com/api/stac/v1/collections/io-lulc-annual-v02
- https://registry.opendata.aws/io-lulc/
- https://www.impactobservatory.com/legal/lulc-methodology-accuracy.pdf

## 3. Kaynak sınıflar

| Kod | Sınıf |
|---:|---|
| 1 | Su |
| 2 | Ağaç |
| 4 | Taşkın vejetasyon |
| 5 | Tarım |
| 7 | Yapılı alan |
| 8 | Çıplak zemin |
| 9 | Kar/buz |
| 10 | Bulut |
| 11 | Rangeland / mera |

0 NoData olarak ele alınır.

## 4. DendroGeo dört sınıf eşlemesi

| DendroGeo | Kaynak kodları |
|---|---|
| 🌿 Yeşil alan | 2, 4, 5, 11 |
| 💧 Su | 1 |
| 🧱 Sert zemin | 7 |
| 🟫 Çıplak zemin | 8 |

Kod 9 ve 10 ile NoData dört sınıfa sessizce dağıtılmaz.

## 5. Zonal alan hesabı

1. Kullanıcının seçtiği park polygonunun WGS84 geometrisi alınır.
2. Polygon bounding box ile 2020 STAC araması yapılır.
3. Polygonu kesen gerekli UTM COG karoları bulunur.
4. Her karonun gerçek raster metadatasından piksel sınırı, boyutu ve kaynak grid çözünürlüğü alınır.
5. Yalnızca polygon bbox ile kesişen raster penceresi COG üzerinden okunur.
6. Her raster hücresinin polygon ile kesişim alanı çokgen-kutu kesişiminden hesaplanır.
7. Rasterın kategorik hücre değeri bu kesişim alanına atanır.
8. Her sınıfın alanı, hücre içinde polygon tarafından kapsanan gerçek alanların toplamıdır.
9. Yüzdeler rasterın polygon içindeki gerçek kapsama alanına göre hesaplanır.
10. Kaynak hücre sayısı yalnızca kalite kontrol bilgisidir; hektar hesabının girdisi değildir.

Bu yaklaşım, coverage fraction / coverage area mantığıyla çalışan standart hassas zonal istatistik yöntemleriyle uyumludur.

## 6. Alan kapanış kalite kontrolü

Dört ana sınıfın toplamı, tüm raster hücreleri geçerli sınıflardan oluşuyorsa analiz alanını kapatır.

NoData, kar/buz veya bulut hücresi bulunursa bu alanlar başka sınıflara aktarılmaz. Ayrı maskeli/veri dışı alan olarak gösterilir.

Raster-polygon kapsama alanı ile seçilen park polygonu arasında %0,5'ten büyük fark oluşursa analiz durdurulur. Sistem farkı oranlayarak kapatmaz.

## 7. OSM'nin rolü

OSM bina, yol, otopark ve su geometrileri arazi örtüsü sayısal sonucuna müdahale etmez.

Bu geometriler grid planlama gibi diğer işlevlerde kullanılabilir. Arazi örtüsü raporunun sınıf değeri yalnızca seçilen park polygonu ve 10 m LULC rasterından gelir.

Arazi örtüsü analizi sırasında kırmızı bina/yol çizgileri otomatik olarak haritaya bindirilmez.

## 8. Görselleştirme

Harita üzerindeki sınıf görünümü yalnızca görsel doğrulama içindir. Sayısal alan hesabı görselleştirme katmanından bağımsızdır.

Yeşil, su, sert zemin ve çıplak zemin sınıfları kaynak raster kodlarının DendroGeo gruplarına göre renklendirilir.

## 9. Dışa aktarma

CSV dört ana sınıfın kaynak hücre sayısını, alanını ve yüzde değerini içerir. Maskeli/NoData alanı ayrı bir QC satırı olarak tutulur.

GeoJSON çıktısı, geçerli 10 m raster hücrelerini ve polygon içindeki gerçek kesişim alanlarını içerir.

## 10. Yöntemin gerekçesi

Kaynak ürün COG olarak yayınlandığı için web uygulaması yalnızca gerekli raster pencerelerini okuyabilir. Ürünün UTM kaynak-gridine hizalı olması, kategorik 10 m hücrelerinin doğal raster koordinat sisteminde işlenmesini sağlar.

Doğru ilke, hücre sınıfını polygon içinde kalan gerçek yüzölçümüyle ağırlıklandırmaktır. Salt hücre sayısını 10 m × 10 m ile çarpmak sınır hücrelerinde hata oluşturur.

## 11. Kaynak ve doğruluk notu

Impact Observatory'nin yayınladığı yöntem/doğruluk özetinde yıllık haritaların bağımsız insan etiketleriyle doğrulandığı ve çoğunluk uzlaşımı ölçütünde yıllık haritaların en az yaklaşık %76 doğruluk düzeyine ulaştığı bildirilir.

2024 tarihli bağımsız karşılaştırmalı çalışmada ESRI LULC ailesi için raporlanan genel doğruluk %85,0'dır. Bu değer belirli bir parkın gerçek sınıflandırma doğruluğunun garantisi değildir.

Bu nedenle DendroGeo sonuçları park içindeki kaynak raster sınıflarının alan dağılımı olarak sunulur; bina sınırı veya yol geometrisi kadar ayrıntılı nesne envanteri olarak yorumlanmamalıdır.