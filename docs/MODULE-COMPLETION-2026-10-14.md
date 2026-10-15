# Ölçüm ve analiz modüllerinin tamamlanması

Başlangıç: `092d01dd5508dc9bc94e5f76db75ed2812533b73` (r420). Kullanıcı kalan ölçüm/analiz modüllerini sırayla bitirmeyi ve ana dala taşımayı açıkça onayladı.

## Tamamlanma ölçütü

- Ağ, depolama ve RLS erişimi adapter portlarında; bilimsel kurallar domain katmanında; iş sırası application katmanında; DOM ve Leaflet sunumu UI katmanında olur.
- Legacy servis adları, incelmiş composition/facade ve test edilen çevrimdışı yedekler olarak korunur. Bir modül oluşturmak için tek satırlık çağrılar veya zaten taşınmış fallback kodu yeniden bölünmez.
- Her yeni modül gerçek çağrı noktasına bağlı, yükleme sırasına ve precache listesine kayıtlı, ilgili kontrat/regresyon testleriyle doğrulanmış olur.
- Ham raster, DBH/karbon, park alanı, kabul edilmiş snapshot, RLS ve kuyruk idempotency değişmez.

## Kaynak envanteri

Ölçüm proje dizini/state, çevre→DBH→karbon, fotoğraf kontrolü, GPS/wake lock, kayıt validasyonu/payload/persistence, düzenleme ve çevrimdışı kuyruk zaten modüllere bağlıdır. Grid, WorldCover/STAC, Sentinel bant okumaları, OSM kanıtı, fırça/hücre/sınır/acceptance/worker akışları da ilgili katmanlara bağlıdır. Kaynaklarda kalan uzun blokların çoğu legacy kontrat testleri için tutulan yedeklerdir.

| Grup | Kalan sorumluluk | Durum |
|---|---|---|
| 1 | Park arama/manual/proje sonuç UI; mevcut GPS ile algılama; güvenli backfill sorgusu | Tamamlandı; 101 ilgili test, tam check, CI, mobil ve üç park QA geçti; PR #489 main’e alındı |
| 2 | Analiz indirme orkestrasyonu; Sentinel dönem-sahne orkestrasyonu; ilk OSM uygulama tamamlaması; hücre önizlemesi; editör çıkış/cleanup yaşam döngüsü | Tamamlandı; 98 ilgili test, tam check, Chromium fırça/çizim/cleanup, CI, mobil ve üç park QA geçti; PR #490 main’e alındı |
| 3 | Fiziksel modül→runtime yükleme→precache tutarlılık kapısı; yeni çekirdek modüllerinin hash koruması; gerçek browser akışlarının CI kapısına alınması | Tamamlandı; check:modules, başarısızlık senaryoları, tam check ve yerel Chromium akışları geçti; sürekli CI denetimi eklendi |

## Kalıcı korumalar

- `npm run check:modules`: 995 fiziksel runtime modülünü başlangıç/lazy/worker yükleme zinciri ve Service Worker precache ile karşılaştırır. Eksik dosya, unutulan modül, iki kez değerlendirme ve kritik modülün kilit dışı kalması CI hatasıdır. Worker relative importları gerçek dosyalara çözülür.
- 617 kritik runtime modülü ve toplam 956 çekirdek/test/koruma dosyası hash kilidindedir; yeni korumalı dosyalar ve değişiklikler yetkili SHA zinciriyle doğrulanır.
- Başlangıç/OAuth, fırça, sabit çizim araçları, açık çizimle cleanup ve OSM XML/ilişki/cache/hata kurtarma tarayıcı kontrolleri artık Mobile smoke CI adımıdır. Fixtureler sahte oturum ve portlarla çalışır; gerçek kullanıcı kaydı yazmaz/silmez.
- Yeni başarısızlık testleri yükleme/precache/kilit eksiklerini ve çift script değerlendirmesini bilerek oluşturarak koruma kapılarının gerçekten durdurduğunu doğrular.

## Devam eden geliştirme kuralı

Yeni kritik modül önce sahipliği ve portlarıyla eklenir; yükleme, precache ve hash kaydı aynı değişikliktedir. Kilitli testler veya bilimsel hesaplar mimari değişiklik için gevşetilmez. Her grup ayrı dal/PR ile check, telefon ve ilgili canlı QA kapılarını geçer; çalışan kullanıcı ekranı otomatik reload ile kesilmez.

## Daha geniş tarama — devam talebi

Kullanıcı önceki üç grubun kapsamından sonra kalan tüm karma sorumlulukları tamamlamayı yeniden istedi. Tüm services/ui/core/utils üst seviye uzun fonksiyonları tarandı. Açılış, sekme geçişleri, park çizme, Blob indirme ve Web Mercator dönüşümleri kalan gerçek karma sınırlar olarak belirlendi. Bağımsız UI renderer dosyaları zaten doğru katmandadır ve yalnız global API adlandırması için tekrar bölünmez.

- Açılış/navigasyon: platform adapter’ı, oturum application akışı, açılış UI controller’ı, DOM aktivasyonu ve sekme veri yenilemeleri beş modüle ayrıldı. Tam check, oturum/OAuth ve harita geçişi Chromium testleri geçti.
- Park/indirme: geometri girdisi, asenkron çizme orkestrasyonu, kart sunumu, indirme adapter’ı ve koordinat dönüşümleri tamamlandı; PR #493 main’e alındı.

Park/indirme grubu: geometri normalizasyonu, seçili park çizme application akışı, park kartı UI sunumu, Blob indirme adapter’ı ve Web Mercator domain dönüşümü beş modüle ayrıldı. Eski dönüşüm sonuçları birebir korundu. Aktif drawPark girişinde epoch ve geometri referansı, geç OSM/kayıt yanıtının yeni kartı güncellemesini engeller. 360/390/430/1280 px gerçek Leaflet, delikli sınır ve native indirme testleri CI’a eklendi. Tam check ve mevcut açılış/çizim regresyonları geçti.

Landing grubu tamamlandı: giriş controller’ı, public istatistik application akışı, toplam/ülke/şehir UI renderer’ları beş ayrı modüle bağlandı. Mevcut public veri adapter’ı ve RLS kontratı korundu. Beklenmedik loader hatası yerelleşir; istatistik isteği görünür landing ve harita başlangıcını bekletmez. Oturum/OAuth yanında anonim giriş de 360/390/430 px Chromium regresyonuna eklendi.

## Son kapsam denetimi

- 15 Ekim devamında yüzey nesnesi seçimi, kayıt/snapshot yükleme, OSM geometri uygulaması ve mount yaşam döngüsü tekil modül sahiplerine indirildi; hücre etkin sınıf kuralı UI'dan saf domain modülüne taşındı. Yeni domain modülü runtime ve offline precache zincirine eklendi.
- Bu değişiklikten sonra 995 fiziksel runtime modülü yükleme/lazy/worker/precache kontrolündedir; 617 kritik runtime modülü ve toplam 956 dosya hash kilidindedir. AST katman/dependency denetimleri sırasıyla 803 ve 939 modül tarar.
- services/ui/core/utils kapsamındaki önceki üst-seviye AST denetiminde modüle delegasyonsuz uzun fonksiyon olarak yalnız bağımsız `dgRenderGridSummary` ve `dgRenderParkAdminHTML` renderer'ları kalmıştı. Yeni yüzey düzenlemesi sınıf kararını domain'e aldı ve mount/OSM/kayıt çift uygulamalarını kaldırdı; kalan compatibility/composition dosyaları yükleme ve katman kapılarıyla izlenir.
- Yeni fixture testleri gerçek kullanıcı kaydı değiştirmeden oturum/OAuth/anonim giriş, park sınırı ve delikler, bayat asenkron yanıt, native dosya indirme ve tablo sunumunu kapsar.
- İlk tam check sırasında mevcut kilitli Sentinel tarih testi, Date.now ölçümüyle yeni Date çağrısı arasında milisaniye geçmesi nedeniyle bir kez başarısız oldu; 91 testlik odaklı tekrar geçti. Bilimsel dönem politikası ve kilitli test değiştirilmedi; son tam check ayrıca çalıştırıldı.

89. grup (batch #89), yüzey editörünün beş sorumluluğunu tek sahipli hale getirdi: OSM nesnesi seçme, kayıt/snapshot yükleme, başlangıç OSM geometri uygulama, harita mount yaşam döngüsü ve etkin hücre sınıfı kararı. Dört application/adapter akışı içindeki eski paralel fallback'ler kaldırıldı; etkin sınıf kararı `src/domain/surface/classify-effective-surface-cell.js` modülüne taşındı. Yeni modül lazy/runtime/offline zincirine ve SHA kilidine eklendi. Ham raster, kullanıcı kararı ve kabul snapshot öncelikleri korundu. 114 hedefli regresyon ve 3.023 tam test geçti; mimari, build, CSP, modül sınırları, telefon tarayıcı smoke ve erişilebilirlik kapıları da doğrulandı.
