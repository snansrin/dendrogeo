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
- Sonraki grup: park çizme/kart orkestrasyonu, park geometri girdisi, indirme adapter’ı ve koordinat dönüşümleri.
