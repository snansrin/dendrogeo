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
| Canlı konum/gizlilik | Park paylaşımı disclosure'ında geçici/veritabanına yazılmayan kapsam açıklaması mevcut | Mevcut GPS/park collaborator/RLS kapıları korunur; visitors presence/location policy ve park-live-share testleri |
| Surface/core | Domain/application/adapters/UI sınırları, DTO'lar ve workers hash/runtime kapısında | CORE-KIRMIZI-CIZGILER geçerli; raw raster, sınıf eşikleri ve kabul snapshot'ı değişmedi |
| Supabase/migration | Yeni idempotent protokol guard migration; izole PostgreSQL'de iki uygulama testi | Tarihsel data rewrite yok; boyutları değiştirmeyen update korunur; canlı katalog/float/RLS checksum kontrolü son kabul adımı |
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

UI/SQL odaklı testler ve yerel erişilebilirlik geçti. 15 Ekim'de tam yerel release kapısı da tekrar çalıştırıldı; PR CI run'ı ve canlı saha kabulü ayrı doğrulama adımlarıdır. Bu kapılar geçmeden tablonun tamamı bitmiş olarak bildirilmez.

Canlı migration `20261014201828_measurement_protocol_guard` uygulandı. RLS aktif kaldı; politika checksum’ı önce/sonra `0bdf1e3fc7610f12ef1565c12a1f7a3a`; dört eski trigger korundu, yalnız yeni protocol trigger eklendi. Kullanıcı satırı yazılmadan saf DB dönüşümü ve katalog doğrulandı.

## 15 Ekim 2026 satır satır yeniden kabul

`npm run check:release` bu çalışma ağacında başarıyla tamamlandı. AST katman kontrolü 802 domain/application/UI modülünü, bağımlılık kontrolü 938 modülü, runtime ve çevrimdışı zinciri 992 modülü (616 kritik hash kilidiyle), sözdizimi kontrolü 999 JavaScript dosyasını denetledi. HTML partial'larında satır içi olay niteliği yok; üretilen HTML'de 40 dosyaya yayılmış 147 handler niteliği mevcut ve bu sayı CI'de artamaz. Bu handler'lar ve büyük eski servis/facade dosyaları temizlenmiş değildir.

Mobil Chromium akışları 360/390/430 px genişliklerinde giriş, OAuth, anonim açılış, fırça (fare/dokunma), çizim araçları, park sınırı/OSM kurtarma ve taşma kontrolünü geçti; çizim sınırı 1280 px'te de geçti. Erişilebilirlik akışı 13 görünümü üç telefon genişliğinde taradı; otomatik erişilebilirlik, klavye switch'i, görünür odak ve slider uçları geçti. Bunlar yerel otomatik kabul kanıtlarıdır; canlı kullanıcılarla saha kabulünün yerine geçmez.

### Güncel 16 satırın durumu

| Satır | 15 Ekim sonucu | Açık kalan kabul şartı |
|---|---|---|
| Proje/veri kuralları; ölçüm formu | Yerel kabul geçti: `girth_cm` ham veri, tam hassasiyetli DBH ve salt-okunur 1 ondalık görünüm testli. | Yok; canlı saha kaydı yazılmadı. |
| Paket/build/CI; rapor/yayın | Yerel release kapısı geçti; PR ve yayın iş akışları `check:release` kapılı. | Önceki push'un güncel GitHub Actions durumu bu oturumdaki commit için alınamadı; yerel başarı CI run'ı sayılmaz. |
| UI modülleri; yüzey/core; tema ve kontroller | Katman/bağımlılık/çekirdek/hash/yükleme kapıları geçti; yüzey önizlemesinin kabul edilmiş veri ve ham alanı değiştirmediği testli. Switch, range, renk ve form kuralları tarandı. | 147 üretilen HTML handler'ı ve büyük legacy facade/controller'lar açık teknik borç. |
| Canlı konum ve gizlilik | Canlı Supabase katalog sorgusunda `realtime.messages` için **0 RLS politikası** bulundu; iki Presence adapter'ı da `private: true` kullanmıyor. Mevcut yayın bu kanal yetkilendirmesini sunucu tarafında kanıtlamıyor. | Gerçek kurucu/normal kullanıcı/anonim istemciyle çapraz park okuma-yazma testleri yapılmalı; Realtime private-channel/RLS geçişi bu kanıt olmadan uygulanmamalı. |
| Supabase şema/migrations | Ölçüm protokol migration'ı ve ölçüm SQL kontratı daha önce canlı katalog + izole PostgreSQL'de doğrulanmış; bu çalışma `realtime.messages` politikalarını salt-okunur sorguladı. | Canlı ölçüm/protokol katalog kontrolü bu turda yeniden koşulmadı. Advisor ayrıca `dg_archive.measurements_bak_0011` için politikasız RLS (arşiv tablosuna erişim kapalı), 4 imtiyazlı park davet RPC'si uyarısı ve kapalı sızmış-parola koruması bildirdi. RPC'ler admin/sahip/kimlik kapılarını içeriyor; advisor bulgusu tek başına yetki aşımı kanıtı değildir. |
| Test/regresyon ve erişilebilirlik | `check:release` tamamen geçti; gerçek Chromium yerel smoke testleri ve klavye/axe kontrolleri dahil. | Manuel ekran okuyucu ve gerçek saha/cihaz kabulü otomatik testin kapsamı dışındadır. |
| Map/GIS/export | Modül ve regresyon testleri, OSM kurtarma ve PNG/GeoJSON sözleşmeleri geçti. | Harici OSM/uydu kaynakları ve gerçek park başına canlı bilimsel doğruluk garanti edilemez; saha QA gerekir. |
| Dokümantasyon/kaynak doğrusu | README UI checklist ve bu kabul tablosu güncel kanıt/sınırlamalarla eşlendi. | Bütün mimari teknik borcun sıfır olduğu iddia edilmez. |

Supabase Realtime yetkilendirmesi politika ve istemcide `private: true` birlikte gerektirir; ayar kapalıysa mevcut public channel istemcileri reddedilir. Realtime ayarı ve gerçek kullanıcı oturumları olmadan güvenli geçişi doğrulamak mümkün değildir. Resmî gereksinimler: [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization), [Realtime Settings](https://supabase.com/docs/guides/realtime/settings).
