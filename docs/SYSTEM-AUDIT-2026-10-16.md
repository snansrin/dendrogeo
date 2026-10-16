# Canlı site ve sistem denetimi — 16 Ekim 2026

Başlangıç commit'i: `a974bb7783efa7698734a0949d882749e7fe05e2`.
Dal: `fix/full-system-audit-20261016`.

## Kapsam ve yöntem

- Kaynak envanteri: 1.751 dosya, 87.464 satır. Oluşturulmuş uygulama paketi, vendor kopyaları ve dondurulmuş DOI klasörleri mükerrer satır sayımından çıkarıldı. Envanter dosya SHA-256 değerlerini içerir. Sayım ve AST/kural taraması otomatik denetimdir; her satırın elle incelendiği iddiası değildir.
- Runtime: 1.006 fiziksel modül; AST katman denetiminde 811 modül, bağımlılık denetiminde 950 modül; 958 kritik dosya SHA korumasında. Katman, bağımlılık, servis sınırı ve satır içi olay borcu kapılarında ihlal yok.
- Elle odaklanılan akışlar: oturum/giriş/çıkış, veri yazma ve onay sonucu, eşzamanlı düzenleme, çevrimdışı kuyruk, fotoğraf taşıma, park/harita portları, yayın arşivi ve keşif dosyaları.
- Canlı tarama: 18 güncel sayfa, ayrıca eski geri çekme bildirimi. Telefon görünümünde kaynak yüklenmesi, görseller, sayfa taşması, anchor'lar ve 41 iç dosya/sayfa bağlantısı incelendi. Kırık iç bağlantı veya tarayıcı JavaScript hatası görülmedi. Rapor galerisi içindeki yatay tablo kendi kaydırma alanında kalır.
- Üretimde ölçüm/proje/yüzey verisine yazma veya silme, yeni yayın/DOI oluşturma ya da şema değişikliği yapılmadı. Yazma/hata senaryoları izole fixture ve PostgreSQL uyumlu yerel motor üzerinde doğrulandı.

## Giderilen bulgular

| Bulgu | Düzeltme | Kanıt |
|---|---|---|
| Çevrimiçi UPDATE sıfır satırda bile başarılı sayılabiliyordu. | Dönen satır doğrulanır. Silinmiş/erişilemeyen/çakışan kayıtta form ve düzenleme açık kalır. | `system-audit-persistence`, `measurement-save-smoke` |
| Çevrimiçi düzenleme başka oturumun değişikliğini ezebilirdi. | Çevrimiçi ve çevrimdışı düzenleme aynı owner + başlangıç alanlarını tek UPDATE içinde karşılaştıran adapter'ı kullanır. Birincil kayıt kimliği değişmez; `client_id` yazma denemesinin kimliğidir. | Ortak adapter, gerçek PostgreSQL uyumlu atomik sorgu testi ve tarayıcı testi |
| Her INSERT hatasında rakım/fotoğraf dosya adı alanları silinip tekrar deneniyordu. | Yalnız PGRST204/42703 ile açıkça belirtilen iki isteğe bağlı sütundan biri için sınırlı uyumluluk denemesi yapılır. İstemcideki taslak değiştirilmez. | İzin, constraint, duplicate ve eksik sütun regresyonları |
| Sunucuya yazılmış çevrimdışı düzenleme, IndexedDB silmesi kesilirse yeniden senkronizasyonda takılabilirdi. | Yeni işlem kimliği + aynı sahip + aynı ölçüm + doğru satır kimliği birlikte kanıtlanırsa tekrar UPDATE/fotoğraf yüklemeden kuyruk tamamlanır. Başka satır/çakışan veri korunur. | `offline-safety` içindeki kesilmiş silme ve yanlış satır testleri |
| Ortak bildirim bileşeni mesaj ve ikon içeriğini ham HTML olarak ekliyordu. | İkon metin olarak gösterilir. Mesajda yalnız basit biçimlendirme etiketleri, hiçbir öznitelik taşımadan yeniden oluşturulur. Aktif/harici etiketler metin olarak kalır. | Chromium/WebKit: img/script/onclick eklenemez; kalın yazı ve satır sonu korunur |
| Sitemap geri çekilmiş DGR-2026-0021'i içeriyor; mevcut 0024/0025/0026 yayınları eksikti. | Sitemap rapor girdileri galerinin geçerli snapshot listesinden üretilir. Yayın/geri çekme ve build/check akışlarına bağlandı; yayın workflow'ları sitemap değişikliğini de commit eder. | İdempotent üretim, yayına ekleme/geri çekmede çıkarma, repo eşitliği testleri |

Supabase'ın `.select()` değiştiricisi yazılan satırları döndürür; yalnız hata alanının boş olması güncellenmiş satır kanıtı değildir. [Resmî JavaScript referansı](https://supabase.com/docs/reference/javascript/using-modifiers-select).

## Canlı veritabanı ve güvenlik

- Supabase durumu `ACTIVE_HEALTHY`; PostgreSQL `17.6.1.166`.
- İncelenen son 24 saatlik API/Edge günlüklerinde 5xx yanıt görülmedi. Tekil 400/401 kayıtları ve bir constraint reddi bulundu; bunlar kesinti kanıtı olarak yorumlanmadı.
- Public uygulama tablolarında RLS açık; public raporlama view'ları `security_invoker=true`.
- Salt okunur transaction içinde gerçek bir hesaba ait olmayan UUID kullanılarak özel yüzey, özel profil ve onaysız ölçüm sayıları **0** bulundu. User metadata içine `role=owner` koymak yönetici yetkisi üretmedi (`is_admin=false`). Transaction rollback ile kapatıldı.
- Profil rol/aktiflik koruma trigger'ı, ölçüm protokolü, park bağı, onay ve konum trigger'ları incelendi; değiştirilmedi.
- Advisor: arşiv tablosunun RLS açık/politikasız olması erişimin kapalı kalmasını sağlar. Dört authenticated SECURITY DEFINER üyelik/davet fonksiyonunun mevcut yetkili kullanım amacı korunur; topluca yetki iptali uygulanmaz. [Advisor açıklaması](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Sızmış parola koruması advisor uyarısı devam ediyor. Önceki denetimde doğrulanan ücretsiz plan kapsamında ücretli yükseltme etkinleştirilmedi. [Parola koruması belgesi](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Kilitli npm bağımlılıklarının tamamında `npm audit` bulgusu **0**. Bu sonuç vendor dosyaları veya bütün sistem için güvenlik sertifikası değildir.

## Regresyon ve yayın kapıları

- `npm run check`: 3.065 test başarılı; çekirdek hash, mimari, modül yükleme/offline manifesti, sözdizimi, sürüm, CSP, kaynak/birim/SQL regresyonları ve sitemap eşitliği geçti.
- `npm run check:phone`: başlangıç, profil, tema, sekme, form, yönetim, fırça, çizim, OSM, dil ve yeni ölçüm kaydetme kabul testleri.
- Chromium ve WebKit: 360/390/430 px; çatışmada taslak korunması, başarılı gerçek satır yanıtında form sıfırlanması, güvenli hata mesajı ve iki dil.
- `npm run check:accessibility`: 13 görünüm, 360/390/430 px, WCAG 2.2 AA dahil otomatik tarama; klavye/odak/switch/slider kontrolleri.
- Yeni ortak adapter ve bildirim modülü yükleme/precache listelerine ve çekirdek hash korumasına eklendi.

Bilimsel hesaplar, eşikler, ham raster, kabul edilmiş geometri, RLS ve dondurulmuş DOI dosyaları değiştirilmedi. Mevcut Chave kaynağı yayıncının [orijinal kaydıyla](https://onlinelibrary.wiley.com/doi/full/10.1111/gcb.12629) karşılaştırıldı; kaynakçada düzeltme gerekmedi.

## Açık işletim/doğrulama işleri

| İş | Mevcut durum | Tamamlanma kanıtı |
|---|---|---|
| Tam sunucu/Auth/Storage yedeği ve izole geri yükleme | Önceki denetimdeki kanıt eksikliği devam eder. Tarayıcı veri yedeği bu kapsamı karşılamaz. | Sunucu yedeği, fotoğraf bayt manifesti ve izole geri yükleme tutanağı |
| Bağımsız park/saha doğruluğu | Üç parkta otomatik spektral karşılaştırma, bağımsız saha referansı değildir. | İnsan etiketli örnekler, dönem uyumu ve bağımsız hata matrisi |
| Fiziksel telefon kabulü | Chromium/WebKit dokunma emülasyonu doğrulandı. | Gerçek iOS/Android cihazda saha/GPS/çevrimdışı kabul kaydı |

Bu rapor belirli testlerin ve incelemelerin kanıtını sunar; gelecekte üçüncü taraf servislerin kesilmeyeceği veya hiç yeni hata oluşmayacağı garantisi vermez.
