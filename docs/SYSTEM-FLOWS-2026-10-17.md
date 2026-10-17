# DendroGeo işlev akışları

Tarih: 2026-10-17 · kaynak anlık görüntüsü: `793c90b26e142669d2056ac910bec4875c888a0c`.

İşlevsel akış aileleri; otomatik çalışma zamanı çağrı izi veya her koşulun canlı testi değildir. Fonksiyon düzeyi tam statik dizin ayrı CSV çıktısındadır.

Saha çevre/çap, boy, allometri ve karbon hesabı çekirdektedir. Kaldırılan uydu tabanlı ağaç algılama ve taç çapı tahmini bu akışlarda yoktur. Mevcut hakem kaydı şeması gerçek hakem atama sistemi olarak gösterilmemiştir.

## İçindekiler

1. [Sistemin genel akışı](#overview)
2. [Landing, dil ve kamuya açık belgeler](#landing)
3. [Oturum, kayıt ve parola kurtarma](#auth)
4. [Profil, kişisel ayarlar ve görünüm](#profile)
5. [Çevre, DBH, boy, allometri ve ölçüm kaydı](#measurement)
6. [Çevrimdışı kayıt ve senkronizasyon](#offline)
7. [Proje oluşturma ve ortak çalışma](#projects)
8. [Kayıtlarım ve kayıt yaşam döngüsü](#records)
9. [Waypoint, CSV, grid ve navigasyon](#waypoint)
10. [Canlı harita ve katmanlar](#live-map)
11. [Park algılama ve sınır yönetimi](#park)
12. [Ham yüzey örtüsü ve kaynak durumu](#surface)
13. [Sentinel-2 taraması ve göreceli NDVI](#spectral)
14. [Hücre, fırça, nesne ve sınır düzenleme](#editing)
15. [Ortak kayıtlı harita ve taze analiz](#shared-surface)
16. [DGR yayın, PDF, DOI ve geri çekme](#publication)
17. [Dışa aktarım ve veri talepleri](#exports)
18. [Dünya verisi, analiz ve park karşılaştırma](#world)
19. [Ölçüm ve park kimliği yönetimi](#moderation)
20. [Kullanıcı ve yetki yönetimi](#users)
21. [Canlı varlık, ziyaretçi ve etkinlik](#visitors)
22. [Veri dışa yedeği ve geri yükleme sınırı](#backup)
23. [Doğrulama araçları ve bilimsel kabul](#quality)
24. [PWA, CI ve yayına çıkış](#delivery)

<a id="overview"></a>

## Sistemin genel akışı

```mermaid
flowchart TD
  start["Açılış ve landing"]
  auth["Giriş ve rol kontrolü"]
  panel["Profil ve çalışma paneli"]
  field["Proje - waypoint - saha ölçümü"]
  map["Park sınırı - yüzey - göreceli NDVI"]
  review["Kayıt ve yüzey kararlarını kabul"]
  report["DGR - DOI - dışa aktarım"]
  admin["Yetkili ölçüm, kullanıcı ve veri yönetimi"]
  start -->|"Çalışmaya başla"| auth
  auth -->|"Geçerli oturum"| panel
  panel -->|"Saha"| field
  panel -->|"Mekânsal çalışma"| map
  field -->|"Kayıt"| review
  map -->|"Yüzey"| review
  review -->|"QA ve yetki uygun"| report
  panel -->|"Yönetici / kurucu"| admin
```

Kaynaklar: [partials/shell.html](../partials/shell.html) · [src/ui/shell-navigation-controller.js](../src/ui/shell-navigation-controller.js)

<a id="landing"></a>

## Landing, dil ve kamuya açık belgeler

```mermaid
flowchart TD
  a["Landing ve altı tanıtım sahnesi"]
  b["Dil, sınıf ve sahne etkileşimleri"]
  c["Gerçek Göksu örneği ve yöntem belgeleri"]
  d["Kamuya açık harita ve istatistik"]
  e["Giriş veya çalışma alanına dönüş"]
  a --> b
  b --> c
  b --> d
  a --> e
```

Kaynaklar: [src/ui/landing-actions.js](../src/ui/landing-actions.js) · [src/ui/landing-home-navigation.js](../src/ui/landing-home-navigation.js) · [src/config/i18n.js](../src/config/i18n.js)

<a id="auth"></a>

## Oturum, kayıt ve parola kurtarma

```mermaid
flowchart TD
  a["E-posta / parola veya Google"]
  b["Auth yanıtı ve hesap durumu"]
  c["OAuth URL temizliği ve oturum çözümü"]
  d["Temiz panel ve role göre menüler"]
  e["Hata - giriş ekranında kal"]
  f["Parola yenileme / çıkış"]
  a --> b
  b -->|"Başarılı"| c
  b -->|"Başarısız"| e
  c --> d
  d -->|"Kullanıcı isteği"| f
  f -->|"Oturum kapandı"| a
```

Kaynaklar: [src/services/auth.js](../src/services/auth.js) · [src/application/auth/start-authenticated-session.js](../src/application/auth/start-authenticated-session.js) · [src/application/auth/sign-out.js](../src/application/auth/sign-out.js)

<a id="profile"></a>

## Profil, kişisel ayarlar ve görünüm

```mermaid
flowchart TD
  a["Profil yükle ve form varsayılanları"]
  b["İsteğe bağlı kişisel / akademik alanlar"]
  c["Kaydet ve oturum sahibi kontrolü"]
  d["Hesap sonucu - hata halinde taslağı koru"]
  e["Açık / koyu / cihaz teması ve dil"]
  a --> b
  b -->|"Değişiklik"| c
  c --> d
  a -->|"Cihaz tercihi"| e
```

Kaynaklar: [src/services/academic-profile.js](../src/services/academic-profile.js) · [src/ui/save-academic-profile.js](../src/ui/save-academic-profile.js) · [src/ui/academic-profile-interactions.js](../src/ui/academic-profile-interactions.js)

<a id="measurement"></a>

## Çevre, DBH, boy, allometri ve ölçüm kaydı

```mermaid
flowchart TD
  a["Proje, nokta, konum ve ölçüm no"]
  b["1,30 m çevresi, boy ve tür / grup"]
  c["DBH = çevre / pi; odun yoğunluğu"]
  d["AGB, kök biyokütlesi, karbon ve hacim"]
  e["Girdi, konum ve varsa fotoğraf QA"]
  f["Çevrimiçi kayıt veya çevrimdışı kuyruk"]
  g["Bekleyen kayıt ve kullanıcı geri bildirimi"]
  h["Geçersiz girdiyi düzelt"]
  a --> b
  b --> c
  c --> d
  d --> e
  e -->|"Geçerli"| f
  e -->|"Geçersiz"| h
  h --> b
  f --> g
```

Kaynaklar: [src/application/trees/submit-measurement.js](../src/application/trees/submit-measurement.js) · [src/application/trees/persist-measurement-submission.js](../src/application/trees/persist-measurement-submission.js) · [src/domain/trees/allometry.js](../src/domain/trees/allometry.js) · [src/config/measurement-protocol-lock.js](../src/config/measurement-protocol-lock.js)

<a id="offline"></a>

## Çevrimdışı kayıt ve senkronizasyon

```mermaid
flowchart TD
  a["Yerel kuyruktaki kayıt"]
  b["Ağ ve aynı oturum sahibi kontrolü"]
  c["Varsa fotoğraf aktarımı ve kayıt yazımı"]
  d["Başarıyı doğrula ve kuyruktan çıkar"]
  e["Hata veya farklı hesap: kuyruğu koru"]
  a --> b
  b -->|"Uygun"| c
  b -->|"Uygun değil"| e
  c -->|"Başarılı"| d
  c -->|"Başarısız"| e
```

Kaynaklar: [src/application/offline/coordinate-measurement-sync.js](../src/application/offline/coordinate-measurement-sync.js) · [src/application/offline/drain-measurement-queue.js](../src/application/offline/drain-measurement-queue.js) · [src/application/offline/sync-queued-measurement.js](../src/application/offline/sync-queued-measurement.js)

<a id="projects"></a>

## Proje oluşturma ve ortak çalışma

```mermaid
flowchart TD
  a["Park bağlamı ve proje listeleri"]
  b["Proje oluştur / düzenle / sil"]
  c["Sahip veya yönetici daveti"]
  d["Doğrulanmış Auth e-postası ile alıcı kontrolü"]
  e["Kabul: park üyeliği; red: daveti kapat"]
  f["Ortak projeyi aç veya parktan ayrıl"]
  g["Ayrılırken mevcut ölçümleri koru"]
  a --> b
  a --> c
  c --> d
  d -->|"Yetki doğrulandı"| e
  e -->|"Üyelik"| f
  f -->|"Ayrılma onayı"| g
```

Kaynaklar: [src/application/trees/save-measurement-project.js](../src/application/trees/save-measurement-project.js) · [src/application/park-invites/manage-invites.js](../src/application/park-invites/manage-invites.js) · [src/application/park-invites/load-recipient-invites.js](../src/application/park-invites/load-recipient-invites.js)

<a id="records"></a>

## Kayıtlarım ve kayıt yaşam döngüsü

```mermaid
flowchart TD
  a["Oturum sahibinin kayıtlarını yükle"]
  b["Proje, tarih ve durumla incele"]
  c["Yetkili düzenleme veya silme isteği"]
  d["Kayıt / fotoğraf işlemi ve sonuç kontrolü"]
  e["Liste ve özetleri yenile"]
  f["Hata: eski kaydı ve anlaşılır mesajı koru"]
  a --> b
  b --> c
  c -->|"Onay"| d
  d -->|"Başarılı"| e
  d -->|"Başarısız"| f
```

Kaynaklar: [src/ui/load-own-records.js](../src/ui/load-own-records.js) · [src/application/trees/edit-measurement-record.js](../src/application/trees/edit-measurement-record.js) · [src/application/dashboard/delete-own-record.js](../src/application/dashboard/delete-own-record.js)

<a id="waypoint"></a>

## Waypoint, CSV, grid ve navigasyon

```mermaid
flowchart TD
  a["Park ve proje seç"]
  b["CSV içe aktar veya grid adaylarını üret"]
  c["Kimlik, koordinat, sınır ve tekrar kontrolleri"]
  d["Proje waypoint kayıtları"]
  e["GPS / pusula ile hedefe yönel"]
  f["Varış: ölçüme geç veya sonraki hedef"]
  g["İzin veya veri hatasını göster"]
  a --> b
  b --> c
  c -->|"Geçerli"| d
  c -->|"Hatalı"| g
  d --> e
  e --> f
  e -->|"Konum kullanılamıyor"| g
```

Kaynaklar: [src/application/parks/upload-waypoint-csv.js](../src/application/parks/upload-waypoint-csv.js) · [src/application/parks/create-grid-waypoints.js](../src/application/parks/create-grid-waypoints.js) · [src/application/map/arrive-at-waypoint.js](../src/application/map/arrive-at-waypoint.js)

<a id="live-map"></a>

## Canlı harita ve katmanlar

```mermaid
flowchart TD
  a["Harita örneğini ve görünümü başlat"]
  b["Onaylı noktaları ve proje katmanlarını al"]
  c["Küme / nokta / izinli fotoğraf detayı"]
  d["Altlık, görünürlük, navigasyon araçları"]
  e["Park analiz moduna geç"]
  a --> b
  b --> c
  a --> d
  d --> e
```

Kaynaklar: [src/application/map/load-live-measurements-map.js](../src/application/map/load-live-measurements-map.js) · [src/application/map/switch-base-map-layer.js](../src/application/map/switch-base-map-layer.js) · [src/application/map/load-approved-measurement-markers.js](../src/application/map/load-approved-measurement-markers.js)

<a id="park"></a>

## Park algılama ve sınır yönetimi

```mermaid
flowchart TD
  a["Harita konumu veya manuel sınır"]
  b["OSM adayları ve gerçek poligon / delikler"]
  c["Zaman aşımı: bağımsız sınır yedeği"]
  d["Geometri geçerliliği ve nokta içerme"]
  e["Park kimliği, proje ve yüzey bağlamı"]
  f["Veri yok: manuel delineasyon öner"]
  a -->|"Sorgu"| b
  b -->|"Dış servis hatası"| c
  b -->|"Geometri geldi"| d
  c -->|"Yedek başarılı"| d
  c -->|"Yedek yok"| f
  d -->|"Geçerli"| e
  d -->|"Geçersiz"| f
```

Kaynaklar: [src/application/parks/detect-park.js](../src/application/parks/detect-park.js) · [src/application/parks/find-nominatim-boundary.js](../src/application/parks/find-nominatim-boundary.js) · [src/services/park-query.js](../src/services/park-query.js)

<a id="surface"></a>

## Ham yüzey örtüsü ve kaynak durumu

```mermaid
flowchart TD
  a["Geçerli park geometrisi"]
  b["WorldCover 2021 v200 hücrelerini oku"]
  c["Gerçek hücre - park kesişimleri ve QA"]
  d["OSM bina / yol / su yardımcı geometrileri"]
  e["Ham sonuç ve veri kapsam durumu"]
  f["Düzenleme ve tarama için geçici önizleme"]
  g["Eksik veri: açık uyarı, önceki kabulü koru"]
  a --> b
  b --> c
  a --> d
  c --> e
  d -->|"Tam veya eksik olarak işaretli"| e
  e --> f
  b -->|"Kaynak hatası"| g
  d -->|"Geometri alınamadı"| g
```

Kaynaklar: [src/contracts/surface-analysis.js](../src/contracts/surface-analysis.js) · [src/services/park-query.js](../src/services/park-query.js) · [src/application/parks/commit-park-coverage-snapshot.js](../src/application/parks/commit-park-coverage-snapshot.js)

<a id="spectral"></a>

## Sentinel-2 taraması ve göreceli NDVI

```mermaid
flowchart TD
  a["Park ve tarih aralığı"]
  b["Sahne, bulut maskesi, bant ve radyometri kontrolü"]
  c["Farklı tarihlerden NDVI / MNDWI / NDBI"]
  d["Zamansal medyan ve gözlem sayıları"]
  e["Yeşil hücre: en az 3 tarih; toplam en az 9 uygun hücre"]
  f["Park içi 1/3 ve 2/3 niceliklerine göre göreceli kademeler"]
  g["Yetersiz kanıt: kademe üretme"]
  h["Gösterim / kullanıcı incelemesi; ham sınıfları değiştirmez"]
  a --> b
  b --> c
  c --> d
  d --> e
  e -->|"Yeterli"| f
  e -->|"Yetersiz"| g
  f --> h
  g -->|"Eksik kanıt bildirimi"| h
```

Kaynaklar: [src/application/surface/collect-sentinel-scene-observations.js](../src/application/surface/collect-sentinel-scene-observations.js) · [src/application/surface/build-sentinel-profile.js](../src/application/surface/build-sentinel-profile.js) · [src/domain/surface/classify-surface-vegetation-tiers.js](../src/domain/surface/classify-surface-vegetation-tiers.js)

<a id="editing"></a>

## Hücre, fırça, nesne ve sınır düzenleme

```mermaid
flowchart TD
  a["Düzenlenebilir analiz önizlemesi"]
  b["Hücre / fırça / nesne / çokgen / dikdörtgen / daire"]
  c["Projeksiyon, geçerli halka ve parka kırpma"]
  d["Geçici sınıf kararı ve geri alma"]
  e["Alan toplamı, kapsam ve kabul kapıları"]
  f["Kabul et ve kaydet: revizyon kontrolü"]
  g["Kabul edilmiş snapshot ve harita"]
  h["Hata: taslak veya önceki kabulü koru"]
  a --> b
  b --> c
  c -->|"Geçerli"| d
  d -->|"Çizimi bitirene kadar"| b
  d -->|"Kabul isteği"| e
  e -->|"Kapılar geçti"| f
  f -->|"Kayıt başarılı"| g
  c -->|"Geometri hatası"| h
  e -->|"Eksik kaynak"| h
  f -->|"Revizyon / ağ hatası"| h
```

Kaynaklar: [src/domain/surface/select-surface-brush-cells.js](../src/domain/surface/select-surface-brush-cells.js) · [src/domain/surface/prepare-surface-boundary.js](../src/domain/surface/prepare-surface-boundary.js) · [src/domain/surface/build-boundary-shape-ring.js](../src/domain/surface/build-boundary-shape-ring.js) · [src/application/surface/accept-surface-analysis.js](../src/application/surface/accept-surface-analysis.js)

<a id="shared-surface"></a>

## Ortak kayıtlı harita ve taze analiz

```mermaid
flowchart TD
  a["Park seçildi"]
  b["Yayıma uygun son kabul edilmiş haritayı oku"]
  c["Sınır ve delik eşleşmesi, veri minimizasyonu"]
  d["Kayıtlı geometriyi göster"]
  e["Yeni tarama / analiz başlat"]
  f["Nötr yeni taslak; önceki snapshot saklı"]
  g["Yeni kabul ve hesap revizyonu"]
  a --> b
  b --> c
  c -->|"Eşleşti"| d
  d -->|"Kullanıcı isteği"| e
  e --> f
  f -->|"Kabul ve kaydet"| g
```

Kaynaklar: [docs/SHARED-PARK-SURFACE-2026-10-16.md](../docs/SHARED-PARK-SURFACE-2026-10-16.md) · [supabase/migrations/20261016145733_shared_park_access_and_accepted_surface.sql](../supabase/migrations/20261016145733_shared_park_access_and_accepted_surface.sql)

<a id="publication"></a>

## DGR yayın, PDF, DOI ve geri çekme

```mermaid
flowchart TD
  a["Park / proje ve isteğe bağlı yayın bilgileri"]
  b["Yetki, ölçüm QA ve kabul edilmiş analiz"]
  c["Yayın isteği ve işlem kimliği"]
  d["OIDC okuyucu ve idempotent CI kuyruğu"]
  e["JSON - CSV - GeoJSON - harita - HTML - PDF"]
  f["Manifest, DGR kimliği ve Zenodo DOI"]
  g["Kamuya açık değişmez rapor"]
  h["Hata: bekleyen / başarısız durumu"]
  i["Yetkili geri çekme: geçmiş ve bildirim"]
  a --> b
  b -->|"Uygun"| c
  c --> d
  d --> e
  e --> f
  f --> g
  d -->|"Hata"| h
  f -->|"DOI hatası"| h
  g -->|"İstek"| i
  i -->|"Geri çekme bildirimiyle korunur"| g
```

Kaynaklar: [src/application/reports/request-publication.js](../src/application/reports/request-publication.js) · [scripts/publish-queue.mjs](../scripts/publish-queue.mjs) · [scripts/register-pending-dois.mjs](../scripts/register-pending-dois.mjs) · [scripts/lib/report-retraction-workflow.mjs](../scripts/lib/report-retraction-workflow.mjs)

<a id="exports"></a>

## Dışa aktarım ve veri talepleri

```mermaid
flowchart TD
  a["Kendi veri kapsamı ve format seçimi"]
  b["CSV / GeoJSON / QGIS çıktısı"]
  c["Ek kamu veri talebi"]
  d["Yetkili inceleme: kabul veya red"]
  e["Onaylı ve izinli satırlarla çıktı"]
  f["Sonuç ve talep durumu"]
  a -->|"Doğrudan yetki"| b
  a -->|"Talep gereken kapsam"| c
  c --> d
  d -->|"Kabul"| e
  e --> f
  d -->|"Red"| f
```

Kaynaklar: [src/application/export/download-user-measurement-export.js](../src/application/export/download-user-measurement-export.js) · [src/application/data-requests/submit-request.js](../src/application/data-requests/submit-request.js) · [src/application/data-requests/fulfill-request.js](../src/application/data-requests/fulfill-request.js)

<a id="world"></a>

## Dünya verisi, analiz ve park karşılaştırma

```mermaid
flowchart TD
  a["Onaylı kayıt agregasyonları"]
  b["Ülke / şehir / park filtreleri"]
  c["Grafik, tablo ve harita"]
  d["Park raporu ve kayıt ayrıntıları"]
  e["Kapsam: gözlenen kayıt toplamı; nüfus veya tüm park tahmini değil"]
  a --> b
  b --> c
  c --> d
  c -->|"Yorumlama sınırı"| e
```

Kaynaklar: [src/application/dashboard/load-world-dashboard.js](../src/application/dashboard/load-world-dashboard.js) · [src/application/world/load-park-comparison.js](../src/application/world/load-park-comparison.js) · [src/application/world/load-park-report.js](../src/application/world/load-park-report.js)

<a id="moderation"></a>

## Ölçüm ve park kimliği yönetimi

```mermaid
flowchart TD
  a["Yönetici / kurucu yetki kapısı"]
  b["Ölçüm ve QA ağacı"]
  c["Onay / red / konum istisnası"]
  d["Denetim kimliği ve durum değişikliği"]
  e["Park yeniden adlandır / birleştir / yanlış kimliği ayır"]
  f["Sonuç ve ilişkileri yenile"]
  a --> b
  b --> c
  c --> d
  a -->|"Ayrı park yönetim işlemi"| e
  d --> f
  e -->|"Onaylı işlem"| f
```

Kaynaklar: [src/application/admin/review-measurement.js](../src/application/admin/review-measurement.js) · [src/application/parks/rename-park-identity.js](../src/application/parks/rename-park-identity.js) · [src/application/parks/delete-park-identity.js](../src/application/parks/delete-park-identity.js)

<a id="users"></a>

## Kullanıcı ve yetki yönetimi

```mermaid
flowchart TD
  a["Yetkili kullanıcı listesi"]
  b["İzinli hesap ve rol alanları"]
  c["Kurucuya özel rol / aktiflik değişikliği"]
  d["Veritabanı profil yetkisi koruması"]
  e["Başarı veya erişim reddi"]
  a --> b
  b --> c
  c --> d
  d --> e
```

Kaynaklar: [src/application/users/load-admin-users.js](../src/application/users/load-admin-users.js) · [supabase/migrations/20261004165219_profile_privilege_guard.sql](../supabase/migrations/20261004165219_profile_privilege_guard.sql)

<a id="visitors"></a>

## Canlı varlık, ziyaretçi ve etkinlik

```mermaid
flowchart TD
  a["Oturum ve mevcut izinler"]
  b["Geçici presence / etkinlik mesajları"]
  c["Yetkili canlı liste, harita ve filtre"]
  d["Duraklat, sekme değiştir veya çıkış"]
  e["Abonelik ve zamanlayıcıları kapat"]
  a --> b
  b -->|"Rol sınırı"| c
  c --> d
  d --> e
```

Kaynaklar: [src/application/visitors/start-presence-session.js](../src/application/visitors/start-presence-session.js) · [src/application/visitors/stop-presence-session.js](../src/application/visitors/stop-presence-session.js) · [src/application/visitors/refresh-owner-view.js](../src/application/visitors/refresh-owner-view.js)

<a id="backup"></a>

## Veri dışa yedeği ve geri yükleme sınırı

```mermaid
flowchart TD
  a["Yetkili yedek isteği"]
  b["Oturum RLS kapsamındaki tablolar"]
  c["JSON ve açık eksik-kapsam listesi"]
  d["Geri yükleme dosyasını doğrula"]
  e["Onay sonrası SQL dosyası indir"]
  f["Yetkilinin ayrı manuel uygulaması"]
  g["Tam sistem / Storage / Auth kurtarması bu akışta yok"]
  a --> b
  b --> c
  c -->|"İçe alma"| d
  d --> e
  e -->|"Uygulama otomatik çalıştırmaz"| f
  c -->|"Kapsam bildirimi"| g
```

Kaynaklar: [src/application/backup/create-full-backup.js](../src/application/backup/create-full-backup.js) · [src/domain/backup/build-snapshot.js](../src/domain/backup/build-snapshot.js) · [src/application/backup/restore-backup.js](../src/application/backup/restore-backup.js)

<a id="quality"></a>

## Doğrulama araçları ve bilimsel kabul

```mermaid
flowchart TD
  a["Alan ve örneklem tasarımı"]
  b["Bağımsız referans etiketleri veya yalnız spektral kıyas"]
  c["Kapsama uygun OA, sınıf doğruluğu ve alan belirsizliği"]
  d["Karbon için ayrı Monte Carlo varsayımları"]
  e["Yorum ve açık doğrulama durumu"]
  f["Referans yok: bağımsız doğruluk iddiası yok"]
  a --> b
  b -->|"Bağımsız veri varsa"| c
  b -->|"Yalnız kaynak / spektral kıyas"| f
  c --> e
  d -->|"Ayrı belirsizlik alanı"| e
  f --> e
```

Kaynaklar: [src/domain/surface/validation-sampling.js](../src/domain/surface/validation-sampling.js) · [src/domain/surface/validation-accuracy-metrics.js](../src/domain/surface/validation-accuracy-metrics.js) · [scripts/lib/mc.mjs](../scripts/lib/mc.mjs)

<a id="delivery"></a>

## PWA, CI ve yayına çıkış

```mermaid
flowchart TD
  a["Kaynak / modül / kilit / build / sürüm kontrolleri"]
  b["Birim ve PostgreSQL sözleşme testleri"]
  c["Telefon, WebKit ve erişilebilirlik testleri"]
  d["Main ve Pages yayını"]
  e["Service Worker ve varlık sürümleri"]
  f["Hata: dağıtım veya rapor kuyruğunu durdur"]
  a --> b
  b --> c
  c -->|"Geçti"| d
  d --> e
  a -->|"Başarısız"| f
  b -->|"Başarısız"| f
  c -->|"Başarısız"| f
```

Kaynaklar: [sw.js](../sw.js) · [.github/workflows/ci.yml](../.github/workflows/ci.yml) · [scripts/check-phone.mjs](../scripts/check-phone.mjs)

## Fonksiyon düzeyi kapsam

`scripts/academic-audit.mjs`, birinci taraf JavaScript dosyalarındaki fonksiyonları başlangıç/bitiş satırlarıyla ve çağrı noktalarını ayrı CSV dosyalarıyla çıkarır. Dinamik bağımlılık enjeksiyonu ve global facade çağrıları nedeniyle bu indeks otomatik kesin çağrı grafiği değildir. Yukarıdaki diyagramlar uygulama davranışının kaynaklarla eşlenmiş işlevsel görünümüdür.
