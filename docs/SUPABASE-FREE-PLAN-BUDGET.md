# Supabase Free Plan — trafik, günlük sorgulama ve Oracle güvenlik kilidi

20 Ekim 2026 tarihinde DendroGeo'nun 29 Eylül–29 Ekim 2026 fatura dönemine ait
Usage görünümünden alınan kullanıcı beyanı. **Bu sayılar canlı sayaç değil,
tarihsel anlık görüntüdür.** Servisler kullanılmaya devam ettikçe değişebilir.

| Sayaç | Kullanılan | Dahil | Anlamı |
|---|---:|---:|---|
| Log Query | 58,664 GB | 100 GB | Studio/Management API/CLI vb. günlük sorgularının taradığı veri; depolama veya Egress değildir |
| Log Ingestion | 0,407 GB | 1 GB | Kaydedilen günlük verisi |
| Egress | 2,512 GB | 5 GB | Önbelleksiz dış veri trafiği |
| Cached Egress | 0,21 GB | 5 GB | Önbellekten sunulan trafik |
| Database Size | 0,037 GB | 0,5 GB | PostgreSQL nesneleri |
| Storage Size | 0,03 GB | 1 GB | Bucket nesneleri |
| Edge Function Invocations | 23.022 | 500.000 | İşlev çağrısı |

Log Query **58,664 GB kullanılan** miktardır; 41,336 GB kalan haktır.
Aşım görülmedi. Log Query tüketimi geçmişe dönük kod değişikliğiyle azaltılamaz;
geçerli fatura dönemi bitince sayaç yenilenir. Egress ve Log Query birbirinden
bağımsızdır. Supabase'in panelindeki Log Query ve Log Ingestion için ücret
uygulamasının 2027 başındaki geçiş dönemi sonrasında başlaması beklendiği
bildirilmiştir; güncel koşullar için Supabase Usage/Billing paneli esastır.

## İncelemenin kanıtları ve sınırları

- 19 Ekim Oracle staging probe denemesi 403 yetkilendirme hatası verdi. Yetki
  aşamasında durdu; üretim fotoğrafı ve kabul edilmiş GIS verisi taşınmadı.
  Bu işlemde Supabase günlüklerini tarayan bir sorgu bulunmamaktadır.
- DendroGeo rapor yayın kuyruğu, işlenmiş `surface_snapshot` alanını gereksiz
  yeniden indiriyordu. 19 Ekim Edge günlüklerinden hesaplanabilen ilgili
  121 yanıt toplamı yaklaşık 138 MB idi. Bu *Egress* trafiğidir, Log Query
  sarfiyatının doğrudan açıklaması değildir. GitHub PR #502,
  işlenmiş kayıtların büyük alanlarını tekrar indirmemeyi sağladı.
- Ayrıntılı günlük analizi sırasında yapılan `query_logs` çağrıları Log Query
  kotasını tüketmiş olabilir. Her sorgu için taranan kesin bayt bilgisi
  bulunmadığından toplamın ne kadarı hangi incelemeden geldiği ispatlanamaz.
  Zaman yakınlığı, Oracle'ın onlarca GB veri aktardığı anlamına gelmez.
- 20 Ekim'de canlı `oracle-storage-probe` v21, tüm istekleri 503 ile
  karşılayan, JWT doğrulaması açık ve **sıfır dış ağ işlemi** yapan sürüme
  değiştirildi. Geçici tarayıcı sayfasının veri bağlantıları kaldırıldı.

## Bağlayıcı işletim kuralları (CI, geliştirici ve otomatik asistan)

1. **Varsayılan: Supabase Logs taraması yapma.** Önce repo kaynaklarını,
   GitHub Actions adım günlüklerini ve mevcut Usage metriklerini incele.
   Bir hata kodunu doğrulamak için bile büyük günlük tablosuna geçmeden önce
   mevcut GitHub/test kanıtının yeterli olup olmadığını değerlendir.
2. Günlük sorgusu zorunluysa önce **hangi soruyu cevapladığını** tanımla.
   Dar zaman aralığı ve hizmet filtresi kullan; ham `SELECT *`, tüm
   kaynakları/ayları tarama, büyük sonuç indirme ve tekrar tekrar deneme yapma.
   Sonucun az satır dönmesi, sorgunun az veri taradığı anlamına gelmez.
3. Log Query, Log Ingestion, Database/Storage Size, Egress ve Cached Egress
   terimlerini birbirine karıştırma. Kaynağı ölçmeden Oracle'a, testlere veya
   ziyaretçilere 30/40/60 GB trafik atfetme.
4. Oracle staging devre dışı kalır. `OCI_STORAGE_PROBE_ENABLED` değerinin
   yanlışlıkla `true` olması bile çalıştırılabilir bir veri yolu yaratmamalı.
   Üretim Supabase Storage kayıtlarına dokunma; özel Oracle anahtarlarını
   herhangi bir günlüğe/sohbete/repoya çıkarma.
5. Gerçek veritabanı değişikliği, test fotoğraflarının aktarımı, işlev
   etkinleştirme veya ücretli kota aşımı ayrı yetkilendirme ve QC gerektirir.
   Her değişiklikte kilitli bilimsel çekirdeği, `npm run check`, Chromium
   telefon ve WebKit regresyonlarını koru.
6. Bağlantı denemeleri ve canlı Supabase log incelemeleri otomatik CI testlerinin
   bir parçası **olmamalıdır**. Testler sentetik veri/mocked `fetch` ile koşmalı.

Oracle'daki servis kullanıcı anahtarı ve Supabase'deki şifreli OCI Secrets
değerlerinin iptal/silme işlemi bu düzeltmede **gerçekleştirilmemiştir**.
Kullanılmayan anahtarların OCI konsolundan iptal edilmesi ve Supabase Secrets'tan
kaldırılması ayrıca doğrulanmalıdır. `oracle-storage-probe` v21 bu değerlere
erişmediği için bağlantı girişimi yapamaz.
