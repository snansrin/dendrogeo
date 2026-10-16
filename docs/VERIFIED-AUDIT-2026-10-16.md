# Doğrulanan güvenilirlik bulguları — 16 Ekim 2026

Başlangıç: `3e5a7cf`. Çalışma dalı: `fix/verified-audit-reliability-20261016`.
Kapsam: kullanıcının mevcut inceleme bulgularını doğrulama ve hataları giderme talebi.

## Kodla giderilen sorunlar

| Alan | Doğrulanan sorun | Düzeltme ve kanıt |
|---|---|---|
| Veri yedeği | Dört tablo; okunamayan talepler sessizce boş diziye dönüyordu | Parklar ve yüzey kayıtları eklendi. Altı tablodan herhangi biri okunamazsa indirme ve başarı damgası oluşmaz. `create-full-backup`, `backup-workflow-integration` testleri. |
| Kurtarma SQL'i | İç içe JSON nesneleri `[object Object]` oluyordu | JSON serileştirme ve park → proje → ölçüm → yüzey bağımlılık sırası. PGlite üzerinde gerçek SQL ile JSON eşitliği ve tekrar çalıştırma doğrulaması. |
| Yedek kapsamı | “Tam yedek” ifadesi sistem kurtarması izlenimi veriyordu | Araç “Veri Yedeği” olarak adlandırıldı; sürüm 1.1.0 manifestinde RLS kapsamı ve hariç tutulan kaynaklar açık. Eski 1.0.0 dosyalarının SQL üretimi desteklenir. |
| Çevrimdışı düzenleme | Yalnız id + owner ile başka oturumdaki değişikliğin üzerine yazabiliyordu | Form açılırken sunucu satırının kopyası tutulur. Çevrimdışı kayıt bu başlangıcı taşır; tek UPDATE bütün başlangıç alanlarını ve owner filtresini karşılaştırır. Değişmiş/erişilemeyen satır ve eski başlangıçsız kuyruk korunur; otomatik üzerine yazılmaz. `audit-reliability-regressions` gerçek PostgreSQL uyumlu motor testi. |
| Sürekli GIS QA | Yeni yüzey modülleri path filtresinin dışında kalabiliyordu | application/domain/adapters surface yolları PR ve main push tetiklerine eklendi. |
| Tarayıcı kapsamı | WebKit yalnız yerelde çalıştırılıyordu | Profil ve sekme/tema kontrolleri WebKit CI işi oldu. Chromium tam telefon paketi sürer. |
| Erişilebilirlik | Otomatik tarama WCAG 2.1 etiketlerinde kalmıştı | WCAG 2.2 AA etiketi eklendi. Bu otomatik tarama, elle ekran okuyucu denetimi veya tam uygunluk sertifikası değildir. |
| Yayın dokümanı | İsteğe bağlı künye alanlarını zorunlu diyordu | Gerçek form sözleşmesiyle uyumlu hale getirildi; doldurulan ORCID denetlenir, yayın/veri kapsamı onayı korunur. |
| Rapor geçmişi | Her donmuş rapor kendisini “geçerli sürüm” ilan ediyordu | Yeni raporların geçmişinde yalnız o raporun yayımlanan anlık görüntüsü olduğu yazılır. Önceki DOI arşivleri değiştirilmez. |

## Canlı veritabanında salt okunur doğrulama

Supabase proje durumu `ACTIVE_HEALTHY`; PostgreSQL 17.6. Park, ölçüm ve
yüzey tablolarının gerçek sütunları ve RLS politikaları okundu. Yüzey kayıtları
yalnız oturum sahibine açıktır. Bu nedenle yönetici veri yedeği bile bütün
kullanıcıların yüzey kayıtlarını içerdiğini iddia edemez. İstemciye ayrıcalıklı
anahtar eklenmedi; RLS veya üretim satırları değiştirilmedi.

Güvenlik advisor çıktısı:

- Arşiv tablosunda RLS açık ve politika yok: erişimin kapalı kalması beklenir;
  erişim açılmadı.
- Dört SECURITY DEFINER davet/üyelik RPC'si authenticated rolüne açık:
  canlı fonksiyon gövdelerinde boş search_path, auth.uid, park sahibi/yönetici
  veya davet alıcısı denetimleri görüldü. Uyarı tek başına açık kanıtı değildir;
  ayrıcalığı kaldırmak mevcut davet akışını bozar. Saldırı senaryolarıyla ayrıca
  doğrulama gerekir.
- Sızmış parola koruması kapalı. Organizasyon planı canlı API'den `free` olarak
  doğrulandı. Bu koruma resmî belgeye göre Pro ve üstünde sunuluyor;
  ücretli plan etkinleştirilmedi.
  [Supabase parola güvenliği](https://supabase.com/docs/guides/auth/password-security).

## Kurtarma sınırları ve işletim işi

Tarayıcı JSON dosyası **tam sistem veya aynı anda alınmış transaction snapshot'ı
değildir**. Yetkili oturumun altı tablodan görebildiği satırları içerir. Aktif
yazma sırasında sayfalı dışa aktarma yerine sunucu tarafı tutarlı yedek gerekir.
Fotoğraf URL'leri dosya baytlarının yedeği değildir.

Tam felaket kurtarması için ayrı ayrı korunmalıdır:

1. Supabase veritabanı, Auth, şema, RLS ve fonksiyonların yetkili sunucu yedeği.
2. Storage bucket dosyalarının baytları ve dosya manifesti.
3. Her saha cihazındaki IndexedDB çevrimdışı kuyruğu ve doğrulama kampanyaları;
   kampanyanın mevcut JSON/CSV dışa aktarma aracı kullanılabilir. Kuyruk
   silinmeden önce başarılı sunucu kaydı doğrulanır.
4. Kaynak deposu ve DOI yayın arşivleri; özel erişim anahtarları ayrı tutulur.
5. İzole ortamda geri yükleme; satır/sahip/park bağı, kabul geometrisi hash'i,
   fotoğraf dosyası hash'i, RLS negatif senaryoları ve kimlik sequence'leri
   doğrulanır. Üretimde deneme geri yüklemesi yapılmaz.

Supabase organizasyonu ücretsiz planda; resmî günlük otomatik yedek hizmeti
Pro ve üstü planlar için belgeleniyor. Mevcut bağımsız yedeklerin gerçek
saklama penceresi ve kurtarma tatbikatı bu kod testlerinden çıkarılamaz.
Bunlar doğrulanmadan “tam
yedekleme tamamlandı” denmez. Resmî kaynak:
[Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).

## Kod değişikliğiyle tamamlanamayacak kanıtlar

Bağımsız saha referans örnekleri, bölgesel allometri doğrulaması, sürekli
operasyonel izleme ve tüm kampanyaların bulut senkronizasyonu ayrı işlerdir.
Otomatik yüzey QA sonucu bağımsız saha doğruluğu olarak sunulmaz. Ham raster,
karbon katsayıları, bilimsel eşikler, kabul edilmiş geometri ve DOI dosyaları
bu çalışmada değiştirilmez.

## Yayın öncesi yerel doğrulama

- `npm run check`: 3.048 test; mimari, yükleme, CSP, sürüm ve 956 dosyalık
  çekirdek kilidi geçti.
- `npm run check:phone`: başlangıç, profil, 11 sekme, açma/kapama kontrolleri,
  yayın formu, park yönetimi, fırça, çizim, OSM kurtarma ve telefon yerleşimi.
- `npm run check:accessibility`: 360/390/430 px; WCAG 2.2 AA dahil otomatik
  tarama, klavye, odak, switch ve slider uçları geçti.
- WebKit: profil 360/390/430/1280 px; sekme/tema/açma kapama kontrolleri
  320/360/390/430/768/1280 px geçti.
