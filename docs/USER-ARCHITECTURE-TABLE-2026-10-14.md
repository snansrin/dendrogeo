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

UI/SQL odaklı testler ve yerel erişilebilirlik geçti. Tam release, PR CI/Mobile/GIS, canlı r428 ve migration katalog doğrulaması son kabul kapılarıdır. Bu kapılar geçmeden tablonun tamamı bitmiş olarak bildirilmez.

Canlı migration `20261014201828_measurement_protocol_guard` uygulandı. RLS aktif kaldı; politika checksum’ı önce/sonra `0bdf1e3fc7610f12ef1565c12a1f7a3a`; dört eski trigger korundu, yalnız yeni protocol trigger eklendi. Kullanıcı satırı yazılmadan saf DB dönüşümü ve katalog doğrulandı.
