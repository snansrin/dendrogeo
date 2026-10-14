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

- `npm run check:modules`: 944 fiziksel runtime modülünü başlangıç/lazy/worker yükleme zinciri ve Service Worker precache ile karşılaştırır. Eksik dosya, unutulan modül, iki kez değerlendirme ve kritik modülün kilit dışı kalması CI hatasıdır. Worker relative importları gerçek dosyalara çözülür.
- Kritik 600 runtime modülünün hepsi hash kilidinde; 315 mevcut modül ve 13 test/koruma aracı daha eklendi. Temel kilit 453 dosyadan 781 dosyaya genişledi. Önceden korunan hashler bu son grupta değiştirilmedi.
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

- Devam talebiyle 15 runtime modülü daha tamamlandı; toplam 959 fiziksel runtime modülü yükleme/lazy/worker/precache kontrolünü geçer. 603 kritik runtime modülü ve toplam 802 dosya hash kilidindedir.
- services/ui/core/utils altında 279 dosyanın AST taraması yapıldı. Modüle delegasyon içermeyen 15 satır üzeri üst seviye işlevler yalnız `dgRenderGridSummary` ve `dgRenderParkAdminHTML`: ikisi de bağımsız UI renderer dosyasında, veri erişimi veya bilimsel hesap orkestrasyonu üstlenmez. Kısa saf yardımcılar ve legacy fallbackler eksik karma modül sayılmaz.
- Yeni fixture testleri gerçek kullanıcı kaydı değiştirmeden oturum/OAuth/anonim giriş, park sınırı ve delikler, bayat asenkron yanıt, native dosya indirme ve tablo sunumunu kapsar.
- İlk tam check sırasında mevcut kilitli Sentinel tarih testi, Date.now ölçümüyle yeni Date çağrısı arasında milisaniye geçmesi nedeniyle bir kez başarısız oldu; 91 testlik odaklı tekrar geçti. Bilimsel dönem politikası ve kilitli test değiştirilmedi; son tam check ayrıca çalıştırıldı.
