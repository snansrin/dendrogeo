# Park ağaç algılaması: doğruluk incelemesi ve uygulama

## Mevcut sonuç neden kesin ağaç sayısı değil?

Roboflow `tree-detection-fuytu/4` nesne kutusu üretir. Her kutu tek ağaç olmayabilir; bitişik taçlar birleşebilir, gölge ve diğer nesneler yanlış aday olabilir. Projenin herkese açık örneklerinden biri üstten çekilmiş ağaçlık alan gösteriyor; fakat eğitim görüntülerinin yer çözünürlüğü, tüm parkları temsil etmesi ve bağımsız Göksu başarısı doğrulanmış değil. Genel model kartı metriği yerel doğruluk değildir. Eşik düşürmek eksik görsel bilgiyi veya eğitim uyumsuzluğunu gidermez.

Z19 harita örnekleme aralığı, kaynak görüntünün gerçek GSD'si değildir. Görüntüyü büyütmek yeni ayrıntı üretmez. Tek RGB görüntüden güvenilir ağaç boyu, DBH veya karbon türetilmez. Kutunun eni de taç sınırı/alanı değildir.

Göksu çevresindeki kamuya açık sınır kutusunda resmi Esri metadata sorgusu iki kaynak döndürdü: sağlayıcının bildirdiği 0,31 ve 0,34 m kaynak çözünürlüğü; 6 Ocak ve 4 Şubat 2026 çekim tarihleri. Bu, her park pikselinin aynı kaynak/tarihe ait olduğunu kanıtlamaz; otomatik metre kalibrasyonu yapılmadı. [Sorgu ve dönen alanlar](tree-imagery-goksu-metadata-2026-10-16.json) kaydedildi. Örnek olarak 3 m taç, 0,31–0,34 m görüntüde yaklaşık 9–10 kaynak pikseline karşılık gelir; bu geometrik örnek, algılama başarısının ölçümü değildir.

Kullanıcı bu inceleme sırasında hem ağaç olmayan nesnelerin seçildiğini (yanlış pozitif) hem gerçek ağaçların kaçırıldığını (yanlış negatif) bildirdi. Sadece eşiği yükseltmek bu iki hatayı birlikte çözmez; sayısal yerel ölçüm henüz yoktur.

## Araştırma karşılaştırması

| Seçenek | Ürettiği çıktı | Uygun kullanım / sınır |
|---|---|---|
| Mevcut RF-DETR modeli | Ağaç aday kutusu | Yerel ölçek denemesi ve yerel etiketlerle yeniden eğitim gerekir. Mevcut güvenli sunucu bağlantısı korunur. |
| DeepForest 2.1 | Ön eğitimli ağaç kutuları ve yerel ince ayar | Üretici, görüntü çözünürlüğü/pencere boyutunun aktarımı etkilediğini ve yerel eğitimin gerekli olabileceğini açıklıyor. Göksu için üstünlüğü ölçülmedi. |
| detectree2, Cambridge urban modeli | Tekil taç maskeleri | Kent ağaçları için karşılaştırılacak güçlü aday; model bahçesinde yaklaşık 200 m pencere öneriliyor. Python/Detectron2 işlem servisi ve model lisansı incelemesi gerekir; Edge Function içine ağır model eklenmedi. |
| Restor TCD | Taç örtüsü / modele göre segmentasyon | Örtü haritası ile tek tek ağaç sayımı farklı hedeflerdir. Örtü maskesindeki birleşik taçları otomatik tek ağaç sayamayız. |
| SAHI yaklaşımı | Örtüşen pencerelerde algılama, birleştirme | Küçük nesne kaybını azaltmak için denenebilir; her veri setinde doğruluk garantisi vermez, çağrı sayısını artırabilir. |

## Bu değişiklikte uygulananlar

- Yerel görüntü penceresi: 768 / 1024 / 1536 piksel; aynı Z19 karo pikselleri, 128 piksel örtüşme. Otomatik büyütme veya yeni ücretli sağlayıcı yok. Standart 1024 korunur; yeni tarama kullanıcı düğmesiyle başlar. 64 pencere sınırı korunur.
- Pencere değiştiğinde eski adaylar temizlenir; güven eşiği mevcut sonuçları yerelde süzer. Sonuç JSON'u pencere, örtüşme, örnekleme aralığı ve doğrulama durumunu içerir.
- Panel güven skorunu doğruluk yüzdesi olarak sunmaz; doğrulanmış ağaç toplamı ve gerçek taç alanı boş kalır.
- Bağımsız referansla çevrimdışı değerlendirme modülü: kutu IoU eşleştirmesi, TP/FP/FN, precision, recall, F1, görüntü başına sayım MAE ve yanlılık. Kalibrasyon parkı test parkıyla aynı olamaz; eşik yalnız kalibrasyondan seçilir. Bu araç COCO mAP veya maske doğruluğu iddiasında bulunmaz.
- Kullanıcının gerçek tarama dosyasındaki kısmi hata incelemesinden sonra dışa aktarma izlenebilirliği geliştirildi: kullanıcı JSON indirince her giriş JPEG'inin SHA-256 özeti, piksel penceresi, indirilme zamanı ve görünür güven eşiğinden önceki normalize adaylar da eklenir. Bunlar yalnız indirmede derlenir; model yanıtının ham kopyası veya referans etiketi değildir. Eski dosyalardaki eksik adaylar/hashler geriye doğru uydurulmaz. Görüntü dosyası başka bir servise otomatik aktarılmaz.
- Landing yalnız kamuya açık `dg_accepted_park_surface(25)` sonucunun 16 Ekim kabul edilmiş geometrisini gösterir. NDVI, önceki yüzey bağlamı/sınırı ve gerçek 15 Ekim gözlemleriyle ayrı tutulur. Kaynak kabul tarihi ve hash saklanır; hesap/oturum verisi dışa aktarılmaz.

## Doğru model seçimi için kalan gerçek veri işi

1. Aynı tarihli ve kullanım izni olan ortofoto/uydu görüntüsünde GSD, tarih ve koordinat dönüşümünü doğrula. Bilinmiyorsa bilinmiyor olarak kaydet.
2. Göksu, Başkent Millet Bahçesi ve farklı yapıdaki başka parkların ayrık örneklerinde tüm görünür ağaçları işaretle. Sık/seyrek taç, bina, gölge, su ve gerçekten boş alanları dahil et. Başlangıç pilotu olarak 200–500 taç yararlı olabilir; yeterlilik hata dağılımı ve temsil kapsamıyla değerlendirilir, bu sayı doğruluk garantisi değildir.
3. Eğitim, kalibrasyon ve son test alanlarını mekânsal olarak ayır; örtüşen pencereler farklı kümelere düşmesin. Başka bir kişi referansları gözden geçirsin.
4. Aynı görüntü/etiketlerle mevcut modelin üç ölçeğini, DeepForest ve kent detectree2 modelini karşılaştır. Eşiği test verisine göre ayarlama. Gerekirse yalnız eğitim kümesinde yerel ince ayar yap.
5. Taç genişliği/alanı için maskeleri ayrıca doğrula: maske IoU/Dice ve saha/ortofoto referansına karşı metre cinsinden genişlik hatası. Kutu metriğini taç alanına dönüştürme.
6. Kabul edilebilir precision, recall ve sayım hata sınırını kullanım amacı için önceden belirle. Bağımsız test geçmeden bilimsel envanterle otomatik birleştirme açma.

Gerçek referans etiketleri henüz bu repoda yok. Dolayısıyla doğruluk artışı, en iyi model veya doğrulanmış park toplamı elde edildiği iddia edilmiyor. Mevcut değişiklik güvenli ölçek denemesi ve ölçülebilir model seçimi altyapısıdır.

## Çevrimdışı değerlendirme

`node scripts/evaluate-tree-detection.mjs reference-and-predictions.json evaluation.json`

Girdi sözleşmesi (`box`: özgün görüntü piksellerinde `[sol, üst, sağ, alt]`; örnek aşağıda biçim gösterimidir, gerçek ölçüm değildir):

```json
{
  "schema": "dendrogeo/tree-validation/1",
  "modelId": "tree-detection-fuytu/4",
  "images": [
    {"id":"tile-a","parkId":"calibration-park","split":"calibration","width":1024,"height":1024,"exhaustivelyAnnotated":true,"annotationSource":"Independent manual annotation","groundTruth":[{"box":[100,100,130,135]}],"predictions":[{"box":[101,102,131,136],"confidence":0.8}]},
    {"id":"tile-b","parkId":"held-out-park","split":"test","width":1024,"height":1024,"exhaustivelyAnnotated":true,"annotationSource":"Independent manual annotation","groundTruth":[],"predictions":[]}
  ]
}
```

## Birincil kaynaklar (16 Ekim 2026 incelendi)

- [Kullanıcının Roboflow modeli](https://universe.roboflow.com/nagihans/tree-detection-fuytu)
- [DeepForest: çözünürlük, pencere ve yerel eğitim](https://deepforest.readthedocs.io/en/stable/user_guide/10_better.html)
- [DeepForest güncel sürüm/API geçmişi](https://github.com/weecology/DeepForest/blob/main/HISTORY.md)
- [detectree2 model bahçesi: urban Cambridge ve ölçek](https://github.com/PatBall1/detectree2/blob/master/model_garden/README.md)
- [detectree2 araştırması](https://doi.org/10.1002/rse2.332)
- [Restor TCD](https://github.com/restor-foundation/tcd)
- [SAHI: örtüşen pencere yaklaşımı](https://github.com/obss/sahi)
- [Esri: görüntü tarihi, kaynak ve çözünürlük metadatası](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/wayback-with-world-imagery-metadata)
- [Uydu/aerial taç segmentasyonunda yapraksız ağaçlar ve hata analizi](https://link.springer.com/article/10.1007/s00521-022-07640-4)

## Görüntü mevsimi

Genel taç segmentasyonu literatüründe yapraksız ağaçlarda geri çağırım kaybı bildiriliyor. Yerel incelemede de çok sayıda yapraksız ağaç görüldü. Bu, modelin kaçırmalarının olası nedenlerinden biridir; tek başına neden-sonuç veya eğitim kümesinin tamamının yapraklı olduğu kanıtı değildir. Uygun lisanslı yapraklı dönem görüntüsü ve kış görüntüleri ayrı değerlendirme gruplarında sınanmalı. Daha yeni tarih otomatik olarak daha iyi algılama anlamına gelmez.
