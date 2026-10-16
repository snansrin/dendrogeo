# Ağaç sayımı ve taç analizi — uygulama planı

## Çalışan çekirdeğin kurtarma noktası

**Koyu tema · Tam analiz**: `4e7647dc9e1b1e62a95b28bb25709490792cdf0c`.
GitHub etiketi: `recovery/koyu-tema-tam-analiz-2026-10-16`.
Kaynak ZIP'i, tam main geçmişini içeren Git bundle ve SHA-256 manifesti çalışma çıktılarındaki `yedekler/koyu-tema-tam-analiz-2026-10-16` klasöründedir. Bundle ayrı klasöre açıldı; 1.930 izlenen dosyanın tamamı kaynakla SHA-256 üzerinden karşılaştırıldı. Küçük sürüm manifesti [burada](recovery-koyu-tema-tam-analiz-2026-10-16.json).

Bu çekirdek kaynak/sürüm yedeğidir. Canlı Supabase satırları, Auth hesapları, Storage fotoğrafları, gizli anahtarlar ve cihaz IndexedDB verileri bu arşivde yoktur. Kaynak kurtarma, canlı veri tabanını geri yüklemek anlamına gelmez. Ayrı klasöre açmak için: `git clone --branch main dendrogeo-koyu-tema-tam-analiz.bundle restored-core`. Canlı çalışma dizininde reset/force push yapılmaz.

## Verilen model hakkında doğrulanabilenler

[Nagihans / tree-detection-fuytu](https://universe.roboflow.com/nagihans/tree-detection-fuytu) herkese açık sayfası 16 Ekim 2026'da incelendi. Sayfa nesne algılama görevi, RF-DETR Nano modeli ve `tree-detection-fuytu/4` kullanım örneği gösteriyor. Üç etiket: `Tree`, `objects-tree`, `tree-top`. Sayfada 1.092 görüntü, mAP@50 %67,6, precision %68,7, recall %63,1 görülüyor. Bunlar proje sayfasındaki değerlerdir; DendroGeo parklarında bağımsız doğrulama veya her model sürümünün aynı metriği taşıdığı iddiası değildir. Eğitim görüntülerinin üstten çekim dağılımı, yer çözünürlüğü ve bağımsız test ayrımı henüz doğrulanmadı.

Model ağaç adayı kutuları için pilot adaydır. Sayfada örnek bölütleme maskesi/poligonu veya ağaç türü çıktısı doğrulanmadı. **Kutu eni/alanı taç çapı/alanı değildir.** Üç etiket tür adı olarak sunulmayacak. Etiketlerin aynı ağacın farklı anlamlarını temsil edip etmediği pilotta incelenecek; çapraz etiket birleştirmesi de doğrulanacak.

## Mevcut / hedef / sonraki iş

| Aşama | Mevcut durum | Hedef ve somut kabul koşulu |
|---|---|---|
| 0 · Çekirdek koruma | Etiket, bundle, ZIP ve dosya geri açma doğrulaması tamam | Bu etikete yeni commit eklenmez; gelişim ayrı dal/modüllerde yürür. |
| 1 · Harita yakınlaşması | Raster altlıkların maxZoom değeri doğal karo seviyesiyle eşitleniyor; eksik uydu seviyesi saptanınca gerçek harita görünümü de sınırlandırılıyor | Zoom düğmesi, tekerlek ve dokunma sınırı aşamaz. Başka alana kaydırınca kapsama yeniden denenebilir; aynı noktada zoom değişimi sınırı tekrar açmaz. |
| 2 · Model incelemesi | Kamusal model bilgileri sabitlendi; yetenek dosyası `config/tree-detection-pilot.json` | Sürüm grafikleri, girdi boyutu/normalizasyonu, çıktı koordinatları, test ayrımı ve etiket anlamları doğrulanır. |
| 3 · Bağımsız ilk prototip | Ağ kullanmayan Roboflow JSON okuyucu ve aday süzme/tek görüntü tekrar eleme prototipi hazır | Gerçek model çıktısı + özgün görüntü metadata'sı ile çalıştırılır; yeniden boyutlandırılmış/letterbox koordinatları düzeltilmeden kabul edilmez. Çıktı yalnız doğrulanmamış aday JSON'udur. |
| 4 · Görüntü girdisi | Canlı uydu altlığı görüntüleme içindir | İşlemeye izinli, çekim tarihi/CRS/GSD/jeoreferansı bilinen üstten ortofoto sağlanır. Ekran yakınlaşması GSD kabul edilmez. |
| 5 · Model çalıştırma adaptörü | Canlı inference veya yeni dış veri aktarımı açılmadı | Önce yerel/izole worker ya da Roboflow serverless seçilir. Gizli anahtar tarayıcıya/loga girmez; hesap kotası ve veri aktarımı açıkça yapılandırılır. İstek iptali, timeout ve boyut sınırı olur. |
| 6 · Park ölçeğinde sayım | Tek görüntü prototipi park toplamı vermez | Jeoreferans dönüşümü, örtüşen karo tekrarları, park sınırı/delik kırpması ve görüntü kapsamı yönetilir. Eksik görüntüde park toplamı gösterilmez. |
| 7 · Taç bölütleme | Verilen modelde taç maskesi doğrulanmadı | Ayrı instance-segmentation adaptörü poligon/maskeler verir. Yerel metrik CRS'de alan, eşdeğer çap ve uygun genişlik ölçülür; kutu ölçüleri ayrı isim taşır. |
| 8 · Bağımsız doğrulama | Yerel park doğruluğu henüz ölçülmedi | Model seçimine kullanılmayan saha/uzman etiketli park kesitleri: precision, recall, F1, sayım hatası, taç IoU ve genişlik/alan hatası. Yoğun, seyrek, genç ağaç ve gölge örnekleri ayrı değerlendirilir. Kabul eşiği pilot öncesinde belirlenir. |
| 9 · Arayüz ve kayıt | Canlı AI paneli açılmadı | Ayrı, isteğe bağlı aday katmanı; insan kabul/ret/birleştir/böl düzeltmesi. Görüntü/model sürümü, zaman, güven puanı, kapsama ve doğrulama kapsamı görünür. Telefon/tema/TR-EN kontrolleri geçer. |
| 10 · Yayın | Mevcut ölçüm/yüzey/rapor akışları korunur | Açık kullanıcı kabulüyle ayrı sürümlü ağaç-analizi kaydı. Yüzey sınıfı, saha ölçümü, DBH, boy, karbon veya dondurulmuş DOI raporu otomatik değiştirilmez. |

## Modül sınırları

`tree-imagery` adaptörü → model çalıştırma adaptörü → saf `tree-detection` domain'i → park kapsamı/tekrar eleme use-case'i → ayrı `tree-candidates` harita katmanı → insan incelemesi → ayrı kabul edilmiş ağaç-analizi snapshot'ı.

Tür tanıma gerekiyorsa saha fotoğrafı için ayrı bir adaptör olur; üstten kutu algılaması tür tanıma sayılmaz. Tek RGB görüntüsünden DBH, ağaç boyu ve karbon ölçülmüş kabul edilmez. Mevcut ham çevre/DBH ve allometri zincirine otomatik veri yazılmaz.

## Model seçenekleri

| Seçenek | Uygun iş | Sınır / karar |
|---|---|---|
| Kullanıcının RF-DETR modeli | Önce ağaç adayı sayımı pilotu | Yerel park testi ve etiket incelemesi gerekli; kutu çıktısı taç maskesi değildir. |
| [DeepForest](https://deepforest.readthedocs.io/en/latest/) | Üstten RGB görüntüde açık kaynak tespit karşılaştırması | Yerel koşulda hazır modelin başarısı ölçülmeli; sunucu/hesaplama ücretsiz olduğu varsayılmaz. |
| [Detectree2](https://github.com/PatBall1/detectree2) | Üstten görüntüde ağaç taçlarının instance segmentation ile sınırlandırılması | Girdi çözünürlüğü ve park yapısı eğitim verisiyle karşılaştırılır; ayrı taç doğrulaması gerekir. |
| [Pl@ntNet](https://docs.plantnet.org/en/reference/api-plantnet/) | Yakın saha fotoğrafından tür önerisi | Uydu ağaç sayımı veya taç poligonu servisi değildir. [Ücretsiz plan](https://my.plantnet.org/pricing) inceleme tarihinde günlük 500 tanıma listeliyor; hesap açılması ve kullanım koşulları gerekir. |

Tek bir servise “her parkta en doğru” denemez. Önce verilen model, gerekirse açık kaynak karşılaştırma modelleri aynı bağımsız örneklerde ölçülür. [Sentinel-2](https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2/) 10 m bantları mevcut NDVI/yüzey kanıtı için uygundur; küçük tekil park ağaçlarının taç genişliği için yeterli girdi kabul edilmez. İlk pilot için yaklaşık 10–30 cm GSD hedefi **öneridir**, doğrulanmış başarı eşiği değildir; ağacın boyutu ve görüntüye göre değerlendirilir.

## İlk prototipi çalıştırma

`node scripts/tree-detection-pilot.mjs predictions.json metadata.json new-output.json`

`predictions.json`, Roboflow'un özgün görüntü koordinatlarındaki `predictions` çıktısıdır. `metadata.json` örneği:

```json
{"imageId":"image-sha256-or-stable-id","modelId":"tree-detection-fuytu/4","width":1024,"height":1024,"confidence":0.5,"nmsIou":0.7}
```

Bu eşikler yalnız çalıştırma biçimini gösteren **örnektir**; üretim için kalibre edilmemiştir. Çıktıda `candidateCount` bulunur; `confirmedTreeCount`, `crownAreaM2`, `crownDiameterM` ve `species` boş kalır. Prototip ağ isteği yapmaz, görüntü/model indirmez, mevcut dosyanın üstüne yazmaz ve canlı veri tabanına bağlanmaz. Gerçek model henüz çağrılmadı. Koordinat/etiket/ölçek incelemesinden önce bu çıktı park envanteri sayılmaz.
