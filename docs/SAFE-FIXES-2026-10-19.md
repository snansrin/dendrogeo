# Güvenli düzeltme denetimi — 19 Ekim 2026

Kaynak: kullanıcının TEK-DOSYA-guvenli-duzeltmeler.md eki. Rapordaki iddialar güncel çalışma kopyası ve salt okunur canlı katalogla karşılaştırıldı. Ekteki “güvenli” etiketi tek başına uygulama gerekçesi değildir.

| Madde | Sonuç |
|---|---|
| S1 | CRLF kontrolü yalnız Git tarafından izlenen metinlere taşındı. Python bytecode üretildikten sonra da geçer. |
| S2 | Renk azaltma uygulanmadı: PNG-8 kayıplıdır; kullanıcı görünümü koruma sınırı nedeniyle ikon baytları korunur. |
| S3 | 4 Python araç testi açıkça sentetik geçici pakete bağlandı; gerçek geri çekilmiş veriler geri yayımlanmadı. CI işi eklendi. |
| S4 | Başvuru durumundaki kırık doğrulama komutu çalışan unittest komutuyla değiştirildi. |
| S5 | Tarihsel audit, başvuru kapıları, taslak ve aday metadata/manifest kaynak geri çekme durumu ile açıklığa kavuşturuldu; eski hash iddiaları geçmiş kayıt olarak korundu. Aday manifest hashleri metadata ile eşlendi. |
| S6 | Aktif rapor bulunmadığı açıklandı; istemci örnekleri aktif kimlik gerektiren şablon olarak etiketlendi. |
| S7 | Canlı 13 public tablo ve Storage RLS bayrakları/politikaları salt okunur incelendi. Yazma sondası çalıştırılmadı; açık etkinleştirme kapısı eklendi. Tam rol/nesne erişim denetimi tamamlanmış sayılmıyor. |
| S8 | Gerçekte bulunmayan araştırmacı/ödül iddiası eklemeden SECURITY-HALL oluşturuldu. |
| S9 | Meta CSP ile HTTP CSP ayrımı ve anti-framing sınırı belgelendi; altyapı değiştirilmedi. |
| S10 | 600 saniye max-age'in her defasında tam indirme anlamına gelmediği dahil cache davranışı açıklandı. |
| S11 | Kamu statik CORS ile özel Supabase erişiminin ayrı olduğu belgelendi. |
| S12 | 0016–0024 yokluğu ve tarihsel kayıt eksikliği belgelendi; “hiç kullanılmadı” diye varsayılmadı. |
| S13 | Yeni migration için yalnız zaman damgalı CLI üretimi, eski adlara dokunmama kuralı eklendi. |
| S14 | Dizindeki bütün migration dosyaları envantere alındı; canlı sürüm adı farkları belirtildi. |
| S15 | Yalnız yerel geliştirme config'i ve boş seed eklendi. Docker/CLI bu ortamda bulunmadığından sıfırdan db reset doğrulanmadı; üretim şeması değiştirilmedi. |
| S16 | README boş aktif arşivi açıklıyor. 404 sayfasındaki çalışan dizin bağlantısı korundu; boş bir dizin kırık bağlantı değildir. |
| S17 | Kabul edilmiş yüzey okuyucu, dışa aktarım filtresi, kamu sahnesi adaptörleri ve gerçek DOM bildirim temizleyicisi test edildi. Üretim modülleri değiştirilmedi. |
| S18 | 3 İngilizce politika eşlikçi sayfası ortak tema ile eklendi; Türkçe hukuki kaynak ve mevcut kurallar korunur. Bu işlem hukuki uygunluk sertifikası değildir. |
| S19 | İngilizce lastmod ve yeni yollar üreticide yönetiliyor; boş arşiv tarihi gerçek geri çekme günlüğünden okunuyor. |
| S20 | PWA id/categories eklendi; aynı dolgulanmamış ikona yanlış maskable etiketi kaldırıldı. Yeni görsel veya sahte ekran görüntüsü üretilmedi. |
| S21 | robots içindeki kuralsız Supabase yorum başlığı kaldırıldı. |
| S22 | Düşük öncelikli konsol temizliği uygulanmadı: çalışma zamanı/paketleme değişikliği bu bakım turuna alınmadı. |
| S23 | noindex 404 sayfasına canonical eklenmedi; mevcut doğru davranış korundu. |

## Koruma ve sınırlar

Allometri, tür/yoğunluk katalogları, ölçüm tabloları/CSV'leri, park algılama, yüzey analizi, grid, araçlar, tema CSS'i ve 1.025 korunan dosyanın hashleri değiştirilmedi. Canlıda INSERT/UPDATE/DELETE/DDL yapılmadı. İkonlar yeniden örneklenmedi. Kilit manifesti ve koruma betiği değiştirilmedi.

Yerel doğrulama: 4 Python araç testi; 22 release testi; 3 adaptör sözleşme testi; 18 URL SEO denetimi; WebKit 360/390/430 px iki tema, taşma, erişilebilirlik ve gerçek DOM aktif-markup engelleme kontrolleri. Genel npm run check başarıyla tamamlandı. Canlı ana sayfa HTTP 200; başlık kısıtları doğrulandı. Anonim onaysız ölçüm ve veri talebi GET sorguları HTTP 200/boş dizi döndürdü. CI ve dağıtım durumu yayımdan sonra ayrıca doğrulanır.

Tamamlanmamış altyapı konuları: bağımsız veritabanında tüm tarihsel migration zincirinin sıfırdan yeniden oynatılması; iki gerçek rol ve Storage nesnesiyle kapsamlı erişim doğrulaması; yanıt güvenlik başlıkları için edge/CDN kararı. Bunlar tamamlanmış gibi raporlanmaz.
