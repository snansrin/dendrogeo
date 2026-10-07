# Üç park — gerçek görüntüyle keşif amaçlı çapraz kontrol

Tarih: 7 Ekim 2026. Bu çalışma, ESA WorldCover 2021 v200 sınıflarıyla bağımsız görüntüyü karşılaştırma akışını sınar. Sonuçlar **saha doğruluğu ya da %100 doğruluk kanıtı değildir**: örnek sınıfları bu oturumda görüntülerden keşif amaçlı yorumlandı; çift uzman etiketi, saha kontrolü ve sabit ortofoto referansı yoktur.

## Örnekleme ve görüntü kaynağı

- Her mevcut harita sınıfından tohumlu, tekrarsız 10 hücre seçildi. Haritada hiç bulunmayan sınıflar bu çerçeveyle ölçülemez.
- Bu açığı azaltmak için bütün park hücre havuzundan bağımsız, sınıftan bağımsız 20 hücre daha seçildi. Bu ikinci örneklem atlanmış sınıfları arar; tek başına alan-düzeltilmiş doğruluk tahmini değildir.
- Hücre sınırının en az %60’ı park içinde olmayan hücreler iki çerçeveden de çıkarıldı. Örnekleme tohumları sırasıyla `20261003` ve `20261007`.
- Görüntüler, Esri World Imagery’nin `2026-10-07` tarihinde servis edilen zoom 19 mozaik karolarıydı. Esri metadata katmanındaki park temsil noktaları bu mozaik için Göksu’da `2026-02-04`, Başkent ve Kuğulu’da `2026-02-21` kaynak görüntüsü; 0,31–0,34 m piksel çözünürlüğü ve 8,47 m bildirilen konum doğruluğu veriyor. Bu nedenle 10 m hücre bazındaki uyuşmazlıklar, sınıflandırma yanında tarih ve georegistrasyon farkı da içerebilir.
- Zamansal karşılaştırmayı iyileştirmek için Esri World Imagery Wayback’in `2021-09-01` sürüm metadata’sı da sorgulandı: temsil noktalarında Göksu kaynağı `2020-04-25`, Başkent ve Kuğulu `2020-11-02`; 0,31 m kaynak çözünürlüğü ve 4,23–5,00 m bildirilen konum doğruluğu. Wayback sürüm tarihi, kaynak görüntünün çekim tarihi değildir. Tarih ve metadata kaynağı: [Esri World Imagery Wayback 2021-09-01](https://www.arcgis.com/home/item.html?id=1e3b8543171b43abbcdff6f613b8358e) ve [metadata servisi](https://metadata.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Metadata_2021_r12/MapServer).

## Keşif sonucu

“Görüntü etiketi” olarak işaretlenen hücreler karar verilemeyen karışık örnekler hariç tutuldu. Sınıf tabakalı bölümde alan ağırlıkları ham rasterdaki sınıf alanlarından alındı. Küçük örneklem için verilen yaklaşık %95 aralıklar yalnız örnekleme değişkenliğini gösterir; görüntü tarihini, 4–8 m konum doğruluğunu veya yorumcu farkını kapsamaz.

| Park | Sınıf tabakalı örnek / yorumlanabilir | Yorumlananlar içindeki ham uyum | Raster alanlarıyla ağırlıklı uyum (yaklaşık %95 aralık) | Park-geneli rastgele örnek uyumu |
|---|---:|---:|---:|---:|
| Göksu Parkı | 40 / 36 | 61,1% | 67,1% (49–85%) | 8/17 = 47,1% |
| Başkent Millet Bahçesi | 40 / 35 | 31,4% | 39,0% (14–64%) | 5/19 = 26,3% |
| Kuğulu Park | 20 / 18 | 55,6% | 62,4% (39–86%) | 14/17 = 82,4% |

Başkent örneklerinde 2026 görüntüsünde suya benzeyen 8/20 park-geneli rastgele hücre görüldü; 2021 rasterında bu rastgele noktaların 7’si yeşil, biri çıplak sınıfındaydı. 2021 tarihli referans görüntüyle yeniden yorumlanmadan bu fark hata diye kesinleştirilemez. Kuğulu rasterında su sınıfı hücresi olmadığı için su tabakalı örnek yoktur; park-geneli örneklemde su adayı olabilecek bir hücre görüldü, ancak mevcut yorum su varlığını kanıtlamaz. Bu iki bulgu otomatik düzeltme değil, insan inceleme kuyruğu için risk işaretidir.

## Geliştirme ve karar

- `dgValSpatialSample` eklendi. Sabit tohumla harita sınıflarından bağımsız park-geneli hücre örnekler; tekrarsızlık ve kenar eşiği regresyon testleri eklendi.
- `scripts/val-qa.mjs --visual-samples-out <dosya> --visual-samples-only` artık Sentinel‑2 profilini beklemeden 10/sınıf tabakalı ve 20 park-geneli örnek noktasını dışa aktarır. Böylece örneklem üretimi canlı raster üzerinde hızlı ve tekrarlanabilir QA adımıdır.
- WorldCover ham rasterı, sınıf eşikleri ve alanlar değiştirilmedi. Görsel incelemede sınıf hatası ile zamansal değişim/georegistrasyon ayrıştırılamadığından eşik kalibrasyonu yapılmadı.
- Sonraki bilimsel kabul için en az 2021 sezonuyla eşleşen, kaynak metadata’sı ve konum doğruluğu hücre boyutuna uygun görüntüde çift uzman/etiket kontrolü gerekir. Güncel 2026 görüntüsüyle karşılaştırma değişim taramasıdır; 2021 sınıflandırmasının tek başına doğruluk karnesi değildir.

Görüntü dosyaları bu depoya eklenmedi. Örnek koordinatları, tabaka, görsel etiket ve örnek çerçevesi [CSV ekinde](gis-visual-validation-20261007.csv) bulunur. Uydu altlığı atfı: Tiles © Esri — Source: Esri, Maxar, GeoEye, Earthstar Geographics, and the GIS User Community.
