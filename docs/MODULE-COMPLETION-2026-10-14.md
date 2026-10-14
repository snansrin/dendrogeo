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
| 1 | Park arama/manual/proje sonuç UI; mevcut GPS ile algılama; güvenli backfill sorgusu | Beş modül eklendi, 101 ilgili test geçti |
| 2 | Analiz indirme orkestrasyonu; Sentinel dönem-sahne orkestrasyonu; ilk OSM uygulama tamamlaması; hücre önizlemesi; editör çıkış/cleanup yaşam döngüsü | Sırada |
| 3 | Fiziksel modül→runtime yükleme→precache tutarlılık kapısı; yeni çekirdek modüllerinin hash koruması; gerçek browser akışlarının CI kapısına alınması | Sırada |
