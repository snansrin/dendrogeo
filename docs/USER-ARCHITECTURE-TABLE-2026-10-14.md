# Kullanıcının mevcut/hedef tablosuna göre mimari kabulü

Kapsam: 14 Ekim 2026'da eklenen 16 satırlı kullanıcı tablosu. Önceki r427 katman tamamlanmasının üzerine UI, erişilebilirlik, SQL ve yayın kapıları eklenir. Satırlar kaynak/test kanıtıyla kapatılır; gerekli bir sonraki satıra otomatik geçilir.

| Alan | Doğrulanan mevcut durum / yapılan işlem | Olması gereken / kabul kanıtı |
|---|---|---|
| Proje ve veri kuralları | Merkezi measurement-protocol-lock fingerprint korundu; ham input adı girth_cm, readonly output adı dbh_cm_display eklendi | Eski mDbh yalnız DOM uyumluluğudur; tam float kayıt ve 1 ondalık sunum ayrı. measurement-protocol-lock + user-architecture-table + PostgreSQL kontrat testleri |
| Paket/build/CI | check:phone, check:accessibility, check:sql, check:release eklendi; her PR tam kaynak ve reusable telefon job'undan geçer | CI path filtresine bağlı değil; publish kuyruğu dogrula ve telefon job'larını bekler |
| UI modül düzeni | Measurement-entry, map, surface-editor ve admin için domain/application/adapter/UI sahipleri zaten ayrılmış; yeni UI davranışı kendi renderer dosyasında kaldı | UI kontrolcüleri DOM/Leaflet sahibidir; saf kurallar veya SDK sorguları UI'a kopyalanmaz. architecture/dependency gates |
| Measurement-entry | girth_cm input semantiği açık, dbh_cm_display readonly output | render-live-measurement-preview hesap nesnesini değiştirmez; derived dbh float verisi testle korunur |
| Switch/checkbox | Kayıt onayı ve üç park kontrolü dg-switch'e geçirildi; mevcut switchler korundu | Native klavye Space, anlamlı label ve focus; source class regression + browser keyboard |
| Range | Ortak dg-range ve native focus eklendi; eski scoped slider stili korundu | 0/100 Home/End, 44 px yükseklik, sıfır padding, 360/390/430 px sınır denetimi |
| Tema/buton/font | Root palette/font değişkenleri aynı; eksik kontrast mevcut renk ailesi/var ile düzeltildi | Durum dolguları/border ve hiyerarşi korunur; axe contrast ve browser layout |
| Önizleme/kayıt ayrımı | Görsel opacity testi raw class/area ve accepted geometry snapshot'ını aynı tutar | user-architecture-table opacity regression + mevcut surface/grid/GIS immutable snapshot testleri |
| Canlı konum/gizlilik | İki Presence adapter'ı private kanala geçirildi ve subscribe öncesi JWT kuruyor; canlı migration dört RLS politikasını ekledi, katalogdan doğrulandı. | Supabase `Allow public access` ayarı hâlâ kapatılmadı; bu ayar değişmeden public konulardan RLS atlanabilir. Kurucu/normal kullanıcı/anonim çapraz-park gerçek oturum testi ayrıca gerekir. |
| Surface/core | Domain/application/adapters/UI sınırları, DTO'lar ve workers hash/runtime kapısında | CORE-KIRMIZI-CIZGILER geçerli; raw raster, sınıf eşikleri ve kabul snapshot'ı değişmedi |
| Supabase/migration | Ölçüm protokolü ve Realtime Presence migration'ları canlıda; dört Presence policy ve dört `search_path=''` ayarı katalogda doğrulandı. | Realtime public-access ayarı, leaked-password protection ve gerçek çoklu kullanıcı Presence kabulü ayrı adımlar. Dört davet RPC SECURITY DEFINER uyarısı mevcut yetki/yetkilendirme nedeniyle hâlâ var. |
| Rapor/yayın | CI kuyruğu test job'larını bekler; manual rapor/kuyruk/DOI check:release kapılı | Test fail → queue/DOI işlemi yapılmaz; always commit adımı validation success şartını taşır |
| Test/regresyon | PGlite gerçek PostgreSQL kontratı, yeni kaynak/UI/yayın kontrat testleri eklendi | Tam check + phone + axe; koşul kapıları bilerek bozulduğunda test reddeder |
| Erişilebilirlik | Dil adları, altlık/park select etiketleri, footer kontrastı, tablo odağı ve toast native kapatma düzeltildi | 13 görünüm × 3 genişlik axe WCAG 2/2.1 A/AA; native klavye disclosure/switch/focus/slider; manuel inceleme ayrıca gerekir |
| Map/GIS/export | Stil/kayıt ayrımı korundu; park delikleri/bayat yanıt/native download önceki gerçek browser suite'inde | accepted geometry/raw raster ve deterministic report-map testleri; üç park live QA |
| Dokümantasyon | README UI kabul listesi, Supabase protokol notu ve bu satır bazlı kayıt eklendi | Kurallar merkezi spec ve ADR'lere bağlı; yeni dependency/migration/testler lock kaydındadır |

## Kaynaklar ve sınırlar

- Merkezi bilimsel sözleşme: `src/config/measurement-protocol-lock.js`, DB migration fingerprint ve runtime/SQL karşılaştırma testi.
- Katman kararı: ADR 0005/0006/0007; core davranış sınırı CORE-KIRMIZI-CIZGILER.
- [axe-core resmi dokümantasyonu](https://github.com/dequelabs/axe-core): otomatik WCAG denetimi tek başına bütün erişilebilirlik sorunlarını kapsamaz. Bu çalışmada otomatik kuralların yanında gerçek klavye ve focus kontrolleri yapılır.
- [PGlite resmi dokümantasyonu](https://pglite.dev/docs/): izole SQL yürütme; prod verisine fixture yazılmaz.
- [Supabase trigger dokümantasyonu](https://supabase.com/docs/guides/database/postgres/triggers): yeni trigger mevcut tablo olayına eklenir; auth/RLS yetkilerini değiştirmez.

## Yayın kabulü

UI/SQL odaklı testler, telefon Chromium akışları ve yerel erişilebilirlik geçti. PR CI run'ı ve canlı saha kabulü ayrı doğrulama adımlarıdır. Realtime public-access ayarı yapılmadığı için gizlilik satırı hâlâ açık; mimari bütünüyle tamamlandı diye işaretlenmiyor.

Canlı migration `20261014201828_measurement_protocol_guard` uygulandı. RLS aktif kaldı; politika checksum’ı önce/sonra `0bdf1e3fc7610f12ef1565c12a1f7a3a`; dört eski trigger korundu, yalnız yeni protocol trigger eklendi. Kullanıcı satırı yazılmadan saf DB dönüşümü ve katalog doğrulandı.

## 15 Ekim 2026 satır satır yeniden kabul

`npm run check`, `npm run check:phone` ve `npm run check:accessibility` son doğrulanmış gönderimde başarıyla tamamlandı. AST katman kontrolü 802 domain/application/UI modülünü, bağımlılık kontrolü 938 modülü, runtime ve çevrimdışı zinciri 992 modülü (616 kritik hash kilidiyle), sözdizimi kontrolü 999 JavaScript dosyasını denetledi. HTML partial'larında ve taranan UI/service markup kaynaklarında olay niteliği yok. Başlangıçtaki 147 üretilen markup handler’ı 40 dosyadan deklaratif, modül sahipliğindeki delegasyona taşındı; borç 0/0 ve CI yeni artışı engelliyor. Büyük legacy facade/controller dosyaları ise açık mimari borç olarak kalıyor.

Mobil Chromium akışları 360/390/430 px genişliklerinde giriş, OAuth, anonim açılış, fırça (fare/dokunma), çizim araçları, park sınırı/OSM kurtarma ve taşma kontrolünü geçti; çizim sınırı 1280 px'te de geçti. Erişilebilirlik akışı 13 görünümü üç telefon genişliğinde taradı; otomatik erişilebilirlik, klavye switch'i, görünür odak ve slider uçları geçti. Bunlar yerel otomatik kabul kanıtlarıdır; canlı kullanıcılarla saha kabulünün yerine geçmez.

### Güncel 16 satırın durumu

| # | Alan | 15 Ekim sonucu | Açık kalan kabul şartı |
|---:|---|---|---|
| 1 | Proje özeti ve veri kuralları | `girth_cm` ham alanı, `dbh_cm = girth_cm / π`, hassasiyet ve fingerprint mevcut; SQL/istemci kontratı testli. | Canlı saha girdisiyle ek kullanıcı kabulü yapılmadı. |
| 2 | Paket/build/test/CI | `check:release` yerelde geçti; CI workflow kaynak ve telefon/erişilebilirlik kapılarına bağlı. | Bu push için GitHub Actions check sonucu connector'da görünmedi; remote CI doğrulanmış değil. |
| 3 | Frontend dosya düzeni/modülerlik | Katman AST'si 802 modülü; dependency kapısı 938 modülü taradı; servis DOM/Supabase/ağ borcu 0; yüzey, park keşfi/kimliği, rapor, profil, kayıt, admin ağacı, landing, grid, ölçüm ve harita grupları dahil 147 handler modül delegasyonuna taşındı; markup borcu 0. | Büyük legacy facade/controller dosyaları, canlı Supabase acceptance ve gerçek parklarla saha QA hâlâ açık; “tamamen borçsuz” değil. |
| 4 | Measurement entry | Form `girth_cm`, ayrı readonly `dbh_cm_display` kullanıyor; ondalık sunumun hesap verisini değiştirmediği testli. | Yok; tarayıcı form smoke testi geçti. |
| 5 | Switch/checkbox | Kaynak checkbox'ları ortak native `.dg-switch`, label ve odak stiliyle taranıyor; klavye testi geçti. | Manuel ekran okuyucu kabulü yapılmadı. |
| 6 | Range/slider | `.dg-range`, 44 px hedef ve 0/100 uçları mevcut; 360/390/430 px ve Home/End kontrolleri geçti. | Manuel dokunmatik cihaz testi yapılmadı. |
| 7 | Tema/değişken/buton | Mevcut tema token/font hiyerarşisi korunuyor; otomatik erişilebilirlik taraması geçti. | Görsel tasarım sahibi kabulü alınmadı. |
| 8 | Surface preview ve kaydedilmiş veri ayrımı | Opacity/preview testleri ham sınıf, alan ve kabul edilmiş snapshot değişmediğini kanıtlıyor. | Yok; davranış/regresyon kapısı geçti. |
| 9 | Canlı konum ve gizlilik | İstemciler private Presence kanalına JWT ile giriyor; canlı `realtime.messages` üzerinde 4 aktif Presence RLS politikası ve park üyelik kontrolü var. | Dashboard `Allow public access` kapalı değil ve gerçek çoklu oturum testi yok. Bu iki kabul adımı tamamlanmadan konum akışı güvenli/bitmiş sayılmaz. |
| 10 | Surface analiz çekirdeği | Domain/application/adapter/UI ayrımı, bilimsel hash, worker/runtime ve kabul snapshot kapıları geçti. | Gerçek park bazında bilimsel saha QA'sı otomatik testin dışında. |
| 11 | Supabase şema/migration | Ölçüm protokol migration'ı ve Presence yetkilendirme migration'ı canlı; policy katalogu ve imtiyazlı RPC `search_path` doğrulandı. | Advisor hâlâ yedek tabloda beklenen erişimsiz RLS, yetkilendirilmiş 4 SECURITY DEFINER davet RPC uyarısı ve kapalı sızmış parola koruması gösteriyor. Auth ayarı henüz değiştirilmedi. |
| 12 | Raporlama/yayın | Publish/DOI akışları `check:release` sonrasına bağlı; yerel release kapısı geçti. | Bu commit'e ait remote CI sonucu yok. |
| 13 | Test/regresyon | `npm run check` geçti; PGlite migration kontratı ve regresyon grupları yeşil. | Remote CI ve canlı kullanıcı kabulü ayrı. |
| 14 | Erişilebilirlik | 13 görünüm × 360/390/430 px; otomatik kurallar, klavye switch'i, görünür odak ve slider uçları geçti. | Manuel ekran okuyucu/uzman incelemesi yapılmadı. |
| 15 | Map/GIS/export | Yerel OSM kurtarma, sınır/fırça/çizim smoke ve PNG/GeoJSON kontratları geçti. | Gerçek park başına OSM/uydu doğruluğu ve dış servis sürekliliği garanti edilemez; saha QA gerekir. |
| 16 | Dokümantasyon/kaynak doğrusu | README, migration rehberi, core-lock değişiklik zinciri ve bu 16 maddelik kabul tablosu güncel kanıtla eşlendi. | 3, 9, 11 ve 15. satırlardaki açıklar kapanmadan tüm mimari tamamen bitmiş sayılmaz. |

Supabase Realtime'da `private: true` ve RLS policy tek başına yetmez; global `Allow public access` ayarı da kapatılmalıdır. Bu ayar tüm bağlı Realtime istemcilerini kesip yeniden başlatır. Resmî gereksinimler: [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization), [Realtime Settings](https://supabase.com/docs/guides/realtime/settings).
