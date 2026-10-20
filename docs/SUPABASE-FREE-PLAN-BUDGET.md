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

## 20 Ekim 2026 — ek ücretsiz kota ve güvenlik doğrulaması

- Kullanıcının yeni Usage anlık görüntüsü: **Log Query 63,1 / 100 GB
  (36,9 GB kaldı)**, **Egress 2,52 / 5 GB**, Log Ingestion yaklaşık
  **0,41 / 1 GB**. Önceki 58,664 GB Log Query anlık görüntüsüne göre
  **4,436 GB ek günlük taraması** var. Taranan veri hacmi, egress veya
  yedeklenmiş dosya boyutu değildir. Tüketim kaynağı zaman damgaları
  üzerinden tekil sorguya bağlanamadı.
- GitHub CI'daki `test/free-plan-security-surface.test.mjs`, çalışma
  zamanında ve otomatik işlerde Supabase Management Logs Query API
  çağrılarını tarayarak reddediyor. Yapılan bu güvenlik incelemesi
  `query_logs` çağırmadan, yalnızca GitHub ve düşük hacimli
  salt okunur PostgreSQL denetimiyle yürütüldü.
- Canlı Storage RLS: `anon` rolüyle `BEGIN READ ONLY` içinde
  `storage.objects` sayım sorgusu **0 nesne** döndürdü.
  `dendro-photos` bucket'ı yayınlanmış fotoğraf URL'lerinin
  çalışabilmesi için hâlâ **public**. **Listelemeyi yasaklamak,
  bilinen fotoğraf URL'sinin anonim GET ile görüntülenmesini
  engellemez**. Fotoğrafların tümünü özel yapmak için rapor
  görselleri ve mobil istemcilerde ayrı, testli mimari değişiklik
  gerekir; otomatik gizlilik değişimi yapıp mevcut raporlar bozulmaz.
- Supabase güvenlik danışmanı, dört `public.dg_invite_*` /
  `dg_is_park_member` `SECURITY DEFINER` RPC için imzalı
  kullanıcı yürütme uyarısı bildiriyor. Anonim `EXECUTE` yetkisi
  **yok**. İşlevlerde `auth.uid()` ve park sahipliği ya da
  doğrulanmış davet e-postası kontrolü görüldü. Bunlar çalışan
  işbirliği akışının parçası; veri erişimini kapatmadan
  değiştirmek testli işlev taşıma gerektirir.
- Danışmandaki “Leaked Password Protection Disabled” bildirimi
  için Supabase **Free plan bu özelliği sunmuyor**; ücretli plana
  otomatik yükseltme yapılmadı. Güçlü ve benzersiz parola/2FA,
  sahip hesabı için ek koruma olarak önerilir.
- Oracle staging'in önceki `storage.mjs` aktarım motoru ve ona bağlı eski
  test dosyaları kod tabanından kaldırıldı. İlk 20 Ekim kontrolünde canlı
  `oracle-storage-probe` v21 JWT doğrulayan ve tüm isteklerde **503** döndüren
  inert uygulamaydı. Daha sonraki 20 Ekim devam kontrolünde işlev ve yedi
  `OCI_STORAGE_*` Edge Secret kaydı Supabase'den silindi; güncel Edge Function
  listesinde Oracle işlevi yok. Oracle sağlayıcısındaki anahtarların iptali
  doğrulanmış değildir.

## İncelemenin kanıtları ve sınırları

- 19 Ekim Oracle staging probe denemesi 403 yetkilendirme hatası verdi. Yetki
  aşamasında durdu; üretim fotoğrafı ve kabul edilmiş GIS verisi taşınmadı.
  **Düzeltme (20 Ekim çevrimdışı kayıt incelemesi):** Bu denemeyi araştırırken
  19 Ekim kayıtlarında iki `query_logs` çağrısı bulundu. İkisi de üç dakikalık
  Oracle işlevi günlük aralıklarını okuyor. Bunlar Logs Query tüketebilen
  inceleme işlemleridir; "günlük sorgusu bulunmamaktadır" ifadesi yanlıştı.
- DendroGeo rapor yayın kuyruğu, işlenmiş `surface_snapshot` alanını gereksiz
  yeniden indiriyordu. 19 Ekim Edge günlüklerinden hesaplanabilen ilgili
  121 yanıt toplamı yaklaşık 138 MB idi. Bu *Egress* trafiğidir, Log Query
  sarfiyatının doğrudan açıklaması değildir. GitHub PR #502,
  işlenmiş kayıtların büyük alanlarını tekrar indirmemeyi sağladı.
- Ayrıntılı günlük analizi sırasında yapılan `query_logs` çağrıları Log Query
  kotasını tüketmiş olabilir. Her sorgu için taranan kesin bayt bilgisi
  bulunmadığından toplamın ne kadarı hangi incelemeden geldiği ispatlanamaz.
  Zaman yakınlığı, Oracle'ın onlarca GB veri aktardığı anlamına gelmez.
- İlk 20 Ekim kontrolünde canlı `oracle-storage-probe` v21, tüm istekleri
  503 ile karşılayan, JWT doğrulaması açık ve **sıfır dış ağ işlemi** yapan
  sürümdü. Daha sonraki devam oturumunda Supabase işlevi ve ilgili Edge
  Secrets kaldırıldı. Geçici tarayıcı sayfasının veri bağlantıları da
  kaldırılmıştı.

## Bağlayıcı işletim kuralları (CI, geliştirici ve otomatik asistan)

1. **Varsayılan: Supabase Logs taraması yapma.** Önce repo kaynaklarını,
   GitHub Actions adım günlüklerini ve mevcut Usage metriklerini incele.
   Bir hata kodunu doğrulamak için bile büyük günlük tablosuna geçmeden önce
   mevcut GitHub/test kanıtının yeterli olup olmadığını değerlendir.
2. Günlük sorgusu zorunluysa önce **hangi soruyu cevapladığını** tanımla.
   Hizmet, kesin zaman aralığı ve sorgu sayısını açıkla; kullanıcı bu belirli
   taramayı açıkça istemedikçe çalıştırma. Genel hata ayıklama/güvenlik
   incelemesi izni günlük taraması izni değildir. Dar zaman aralığı ve hizmet filtresi kullan; ham `SELECT *`, tüm
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

20 Ekim devam oturumunda `oracle-storage-probe` Supabase'den silindi ve yedi
`OCI_STORAGE_*` Edge Secrets kaydı kaldırıldı; işlev listesi ve yeniden açılan
Secrets ekranıyla doğrulandı. Oracle hesabındaki anahtarların iptali ayrıca
doğrulanmış değildir; Supabase'den silmek Oracle anahtarını iptal etmez.

## 20 Ekim — günlük tüketiminin çevrimdışı neden incelemesi

Yeni Supabase günlük sorgusu çalıştırmadan, mevcut yerel oturum/araç çağrısı
kayıtları karşılaştırıldı. Aynı SQL ve araç zaman aralığının kopyaları ayıklanınca
14–19 Ekim kayıtlarında 19 farklı `query_logs` çağrısı görüldü: 14 Ekim 3,
15 Ekim 6, 16 Ekim 8, 19 Ekim 2. Bunlar eksiksiz erişim denetimi değildir;
bulunabilen çağrılar için alt sınırdır, faturalandırılan tarama baytları değildir.

- 15 Ekim: birden fazla kaynağı kapsayan 24 saatlik sayım, alan anahtarı ve
  hata/timeout metni aramaları.
- 16 Ekim: sekiz çağrı; yedisinde araç düzeyinde açık başlangıç/bitiş aralığı
  yok. Bir sorgu `select source, count() as events from logs group by source`
  biçiminde tüm kaynakları sayıyor; diğerleri alan/hata incelemeleri ve
  tree-detection teşhisi. API'nin o çağrılara uyguladığı varsayılan aralığın ve
  taradığı kesin baytların kaydı bulunamadı. `LIMIT` tarama bütçesi değildir.
- 19 Ekim: iki üç dakikalık Oracle teşhis sorgusu bulundu. Aynı günün grafikteki
  yaklaşık 24 GB sıçramasının tamamını bu iki çağrıya bağlayan kanıt yok.
- 19 Ekim eklenen ziyaretçi özetleri normal veri/API işlemleridir. İncelenen
  kaynakta bunların Management Logs/Analytics okuyucusu olduğu görülmedi.
- Rapor kuyruğunun tamamlanmış büyük snapshot'ları tekrar indirmesi ayrı bir
  Egress kusurudur; `a906241` / PR #502 ile 20 Ekim'de düzeltilmiştir. Bunu
  Logs Query artışının açıklaması olarak sunmak doğru değildir.

Önceki geniş asistan incelemeleri doğrudan kota tüketen işlemlerdir ve tüketim
artışına katkıda bulunmuş olabilir. Kesin GB payı bilinmiyor. Site sayfası silmek
veya fotoğraf bucket'ını gizlemek tüketilmiş Logs Query sayacını geri almaz.
`AGENTS.md` artık özel kullanıcı isteği olmadan bu taramaları yasaklar; CI
koruması alternatif log API/CLI girişlerini de tarar. Bunlar tekrarını önleyen
proje kontrolleridir; Supabase tarafında teknik kota kesicisi değildir.
