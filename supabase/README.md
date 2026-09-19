# supabase/ — veritabanı şeması ve güvenlik denetimi

Bu dizin **boş bir iskelet olarak eklendi.** Amaç: projenin güvenlik modelinin
tamamını taşıyan RLS politikalarını, trigger'ları, view tanımlarını ve
constraint'leri repoya taşımak.

## Mevcut durum

Bu repoda, bu dizin eklenene kadar **tek satır SQL yoktu.** Şema yalnızca
Supabase kontrol panelinde yaşıyor. `README.md` ve `SECURITY.md` şu iddiaları
taşıyor:

> "All data access is enforced server-side via Row Level Security (RLS)
> policies and database triggers. The `service_role` key is never exposed."

> "✅ Supabase Row Level Security (RLS) on all tables"

Anon key `src/config/supabase.js` içinde açık (bu **tasarım gereği ve doğru** —
README'de belgelenmiş). Yani güvenliğin tek dayanağı RLS'in doğru olması.
**Ama RLS politikaları depodan denetlenemiyor.** Bu, projenin en büyük
bilinmeyeni ve statik kod incelemesiyle kapatılamaz.

## Yapılacaklar

### 1. Şemayı repoya aktar (5-15 dk)

```bash
brew install supabase/tap/supabase      # veya npm i -g supabase
supabase login
./supabase/dump-schema.sh
```

Çıktı: `supabase/migrations/0001_init.sql`. Bundan sonraki her değişiklik yeni
numaralı dosya olarak eklenmeli (`0002_...sql`), mevcut dosya düzenlenmemeli.

### 2. RLS denetimini yap → `supabase/audit/RLS-DENETIM.md`

Oradaki liste, **anon key ile giriş yapmadan** yapılması gereken saldırı
denemelerini içeriyor. Hepsi reddedilmeli. Bu, projenin en kritik güvenlik
testi ve şu ana kadar yapıldığına dair bir kayıt yok.

### 3. Şemada olması önerilen ama kodda izi olmayan alanlar

Kod incelemesinde şu alanların **hiçbir yerde geçmediği** görüldü:
`reviewed_by`, `reviewed_at`, `reject_reason`, `deleted_at`, `allometry_version`,
`rho_used`. Bunlar için `supabase/migrations/0002_audit_columns.sql` önerilir —
ayrıntı yol haritası belgesinde.

## Bilinen şema yüzeyi (koddan çıkarıldı)

Kod incelemesiyle tespit edilen tablo ve view'lar:

| Nesne | Kodda geçme sayısı | Kullanım |
|---|---|---|
| `measurements` | 33 | ana tablo; admin onaylı yayın akışı |
| `waypoints` | 9 | CSV'den yüklenen örneklem noktaları |
| `projects` | 8 | |
| `data_requests` | 7 | kullanıcı → yönetici veri talebi |
| `profiles` | 6 | `role` alanı istemcide okunuyor (admin.js) |
| `site_visits` | 4 | anonim sayaç — `insert({})`, kişisel veri yok |
| `v_global` / `v_country` / `v_city` | 3 / 2 / 2 | view'lar (tanımları bilinmiyor) |
| Storage bucket `dendro-photos` | — | yol: `${owner}/${Date.now()}_${id}.jpg` |

RPC (`.rpc(...)`) kullanılmıyor; tüm erişim REST üzerinden.

## Bilinmeyenler

* `profiles.role` alanı **istemciden yazılabiliyor mu?** `admin.js` içindeki
  `PROFILE.role !== "admin"` denetimi yalnızca arayüz içindir; gerçek koruma
  RLS'te olmalı. Eğer `role` istemciden güncellenebiliyorsa **yetki yükseltme**
  açığı vardır.
* `dendro-photos` bucket'ında kullanıcı başına yol izolasyonu **politika ile**
  mi sağlanıyor? Kod yolu doğru kuruyor ama başka bir kullanıcının yoluna
  yazmayı engelleyen şey RLS/Storage politikası.
* `measurements.status` değerleri bir `CHECK` constraint'i ile mi sınırlı?
  Kod `"Onaylı"` / `"Beklemede"` / `"Reddedilen"` kullanıyor.
* `status`, `lat`, `lon`, `owner`, `project_id` üzerinde **indeks var mı?**
  Yoksa `.eq("status","Onaylı")` filtreleri ve bbox sorguları veri büyüdükçe
  yavaşlar.
* Silme davranışı: `.delete().eq("id",id)` kalıcı silme. CASCADE var mı?
  Fotoğraf Storage nesneleri yetim kalıyor mu? (`admin.js`'teki `cleanOrphans()`
  bu sorunun varlığına işaret ediyor.)
