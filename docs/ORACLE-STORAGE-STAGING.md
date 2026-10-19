# Oracle dosya depolama geçişi — hazırlık

## Durum

- Paris ana bölgesinde `dendrogeo-staging-private` oluşturuldu: özel erişim, Standart katman, Oracle anahtarıyla şifreleme.
- VM kurulamadı: A1 (2/12 ve 1/6) ile E2.1.Micro oluşturma denemeleri kapasite dolu yanıtı verdi.
- 19 Ekim 2026 salt okunur sorgusunda Supabase Storage: 63 fotoğraf, 29.236.066 bayt. Bu depolama boyutudur; aylık trafik değildir.
- Üretim dosyaları taşınmadı. Ölçüm, çevrimdışı senkronizasyon, silme, allometri, türler, park/yüzey motorları ve tema değişmedi.
- `oracle-storage-probe` Edge Function sürüm 10, JWT doğrulaması açık olarak yayımlandı. Elle doğrulama için hazırlanan geçici `/oracle-storage-check/` sayfası oturum belirtecini yalnız `supabase.functions.invoke` üzerinden kullanır; belirteç DOM'a, günlüklere veya rapora yazılmaz. İşlev DendroGeo origin'ini ve Auth tarafından doğrulanan tek kullanıcıyı sınırlar. Test bayrağı `false`; gerçek Oracle yazma/okuma denemesi henüz yapılmadı.
- `dendrogeo-storage-probe` servis kullanıcısı ve yalnız bu kullanıcıya atanmış `DendroGeoStorageProbe` grubu oluşturuldu. Yönetici üyeliği yoktur. Mevcut yönetici politikası yalnız Administrators grubuna uygulanır.
- `DendroGeoStorageProbeOnly` politikası yalnız `dendrogeo-staging-private` içindeki `connectivity-check/*` nesnelerinde `OBJECT_CREATE` ve `OBJECT_READ` izinleri verir. Nesne silme/üzerine yazma ve bucket/hesap yönetimi izni içermez.
- Kullanıcının dar kapsamlı erişim onayı ve Supabase yönetim girişi sonrasında servis hesabında tek Customer Secret Key oluşturuldu. Gizli değer yalnız `OCI_STORAGE_SECRET_ACCESS_KEY` adlı Supabase şifreli Secrets kaydına aktarıldı; kayıt digest ve güncelleme zamanı üzerinden doğrulandı. Değer bu belgeye, dosyalara veya sohbet çıktısına yazılmadı.
- Oracle arayüzündeki erişim kimliği kopyalama kontrolü otomasyona boş pano değeri döndürdü; kullanıcı kimliği doğrudan Supabase Secrets'a kaydetti. `OCI_STORAGE_ACCESS_KEY_ID` ve `OCI_STORAGE_SECRET_ACCESS_KEY` isimli Secrets kayıtları panelde mevcut. Gizli değerler okunmadı veya paylaşılmadı. Gerçek yazma-okuma doğrulaması henüz yapılmadı.
- Geçici yönetim doğrulaması denenirken Dashboard Test isteğinin kimlik başlığı göndermediği görüldü. Yönetici anahtarı panele eklenmedi veya istemciye çıkarılmadı. Yönetici doğrulama yolu son dağıtımdan kaldırıldı; işlev yalnız Supabase Auth ile doğrulanan, ayarlı kullanıcı UUID'sine izin verir. `OCI_STORAGE_PROBE_ENABLED=false` olarak ayarlandı ve boş başlıklı son test `503 Probe disabled` yanıtıyla doğrulandı. `OCI_STORAGE_PROBE_ADMIN_ENABLED=false` olarak da kaldı.

## Ücretsiz kullanım sınırı

Oracle konsolu denemede 10 GiB standart + 10 GiB arşiv, deneme sonrasında toplam 20 GiB bildiriyor. Object Storage için aylık 50.000 API isteği dahil. Ücretsiz aktarım hakkı istek kotasını ortadan kaldırmaz. Ücretli hesaba yükseltme yok. İlk aşamada standart dosyaları 10 GiB altında tutun; arşiv sık erişilen fotoğraflara uygun değildir. Bütçe alarmı sert kullanım kesici değildir.

## Güvenli bağlantı denemesi

1. Yalnız bu bucket için nesne oluşturma ve okuma izni olan ayrı OCI servis kimliği hazırlayın. Hesap yöneticisinin anahtarını kullanmayın. Kullanıcı/grup/politika ve kalıcı anahtar oluşturma güvenlik onayı gerektirir.
2. Customer Secret Key değerlerini yalnız Supabase Edge Function Secrets'a `OCI_STORAGE_ACCESS_KEY_ID` ve `OCI_STORAGE_SECRET_ACCESS_KEY` olarak koyun. Sohbete, repoya, tarayıcı kaynaklarına veya komut satırı argümanlarına yazmayın.
3. `OCI_STORAGE_PROBE_USER_ID` yalnız denemeyi yürütecek yetkili hesabın UUID'sidir. `OCI_STORAGE_PROBE_ENABLED=true` yalnız manuel doğrulama süresince açılır; ardından `false` yapılır.
4. Edge Function JWT doğrulaması açık (`verify_jwt=true`) yayımlanır. İşlev ayrıca Auth sunucusundan gerçek kullanıcıyı doğrular ve yalnız belirtilen UUID'ye izin verir.
5. Yalnız geçici doğrulama süresince `OCI_STORAGE_PROBE_ENABLED=true` yapılır. `/oracle-storage-check/` sayfasında tek POST isteği iki nesne isteği yürütür: rastgele UUID adlı, küçük sentetik metni yazar ve aynı metni geri okuyup eşleşmesini doğrular. Anahtar, oturum veya gerçek fotoğraf Oracle'a aktarılmaz. Deneme nesnesi özel alanda kalır; üretim verisiyle karışmaz. İşlevi genel kullanıma açmayın: küresel kota kesicisi yoktur.
6. Sonuç ne olursa olsun test bayrağı derhal `false` yapılır. Geçici sayfa kaynaktan kaldırılıp yayınlanır. Nesne yalnızca bu özel deneme alanında kalır; servis kimliğine silme izni verilmediğinden konsoldan veya ayrı idari iş akışıyla kaldırılması gerekir. Mevcut uygulama hâlâ Supabase kullanır.

## Üretim geçişi için henüz yapılmayan işler

- Storage/Database/Auth trafik kırılımıyla gerçek darboğazı ölçme. Dosyaların taşınması Database Egress'i düşürmez.
- Yeni dosyalar için sahiplik denetimli yükleme ve kısa ömürlü indirme bağlantıları; proje paylaşım izinleri; MIME/boyut sınırı; yükleme sonrası bütünlük kontrolü.
- Çevrimdışı kuyruk, fotoğraf silme, dışa aktarma, eski public URL'ler ve kayıtlı raporlarla geriye uyum.
- Dosyaları Supabase üzerinden proxy'lemeyen veri yolu (aksi halde trafik tasarrufu sağlanmaz).
- İstek/alan sınırı, geri dönüş anahtarı, uçtan uca doğrulama; en son üretim etkinleştirme.

Mevcut fotoğraf adapterleri çekirdek kilidinde olduğundan hashler otomatik yenilenmez. Deneme başarılı olmadan üretim geçişi yapılmaz. Mevcut Supabase dosyalarını silmek bu hazırlığın parçası değildir.

## Resmî kaynaklar

- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/s3compatibleapi.htm
- https://docs.oracle.com/en-us/iaas/Content/Identity/access/working-with-customer-secret-keys.htm
