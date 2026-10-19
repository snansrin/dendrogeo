# 🔐 RLS Denetim Listesi

**Bu, projenin en kritik güvenlik testi.** Anon key `src/config/supabase.js`
içinde açık (tasarım gereği, README'de belgeli). Yani güvenliğin **tek**
dayanağı Row Level Security politikaları — ve o politikalar bu denetim
yapılana kadar hiç test edilmemiş olabilir.

Denetim iki yolla yapılabilir: aşağıdaki betik (`rls-probe.sh`) ya da elle.
**Giriş yapmadan**, yani `anon` rolüyle çalıştırılmalıdır.

## Beklenen sonuçlar

| # | Deneme | Beklenen | Olursa ne olur |
|---|---|---|---|
| 1 | `measurements`'a anonim INSERT | ❌ **reddedilmeli** | Herkes sahte ölçüm yayınlayabilir |
| 2 | `measurements`'a anonim UPDATE | ❌ reddedilmeli | Herkes başkasının verisini değiştirebilir |
| 3 | `measurements` DELETE | ❌ reddedilmeli | Veri silinebilir |
| 4 | `profiles.role` yazma | ❌ **reddedilmeli** | **Yetki yükseltme → admin paneli** |
| 5 | `profiles` INSERT (kendi id'siyle) | ⚠️ politikaya bağlı | Kayıt akışı buna dayanıyor olabilir |
| 6 | Başkasının `owner`'ıyla INSERT | ❌ reddedilmeli | Başkası adına veri |
| 7 | `dendro-photos/{başka-owner}/...` yükleme | ❌ **reddedilmeli** | Başkasının fotoğraf alanına yazma |
| 8 | `site_visits` INSERT | ✅ **izinli olmalı** | `trackVisit()` anonim `insert({})` yapıyor |
| 9 | Onaylı kayıtları SELECT | ✅ izinli | Dünya haritası bunu gösteriyor |
| 10 | Onay BEKLEYEN kayıtları SELECT | ❌ reddedilmeli | Yayınlanmamış veri sızar |
| 11 | `service_role` key'in repoda olmaması | ✅ | Zaten README'de belirtilmiş |
| 12 | `data_requests` anonim SELECT | ❌ reddedilmeli | Kullanıcı talepleri sızar |

## Elle denetim (betik çalıştırmak istemezseniz)

Tarayıcı konsolunda, **giriş yapmamışken** (gizli sekme):

```js
// 1) anonim insert
await sb.from('measurements').insert({ lat: 0, lon: 0, dbh_cm: 1, height_m: 1 }).then(console.log)
// beklenen: { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }

// 4) YETKİ YÜKSELTME — en kritik olanı
await sb.from('profiles').update({ role: 'admin' }).eq('id', '<herhangi-bir-uuid>').then(console.log)
// beklenen: error 42501  (ya da 0 satır etkilenir — ikisi de kabul edilebilir)

// 10) onay bekleyenleri okuma
await sb.from('measurements').select('*').neq('status', 'Onaylı').limit(5).then(console.log)
// beklenen: error ya da boş dizi

// 12) başkalarının taleplerini okuma
await sb.from('data_requests').select('*').limit(5).then(console.log)
// beklenen: error ya da boş dizi
```

`42501` = PostgreSQL `insufficient_privilege` → RLS çalışıyor.
`PGRST116` / boş `data` → politika satırı filtreliyor, bu da kabul edilebilir.
**`data` dolu dönerse açık var.**

## Denetim sonrası

* Sonuçları bu dosyaya işleyin (aşağıdaki tablo).
* Bir açık bulunursa: Supabase panelinde politikayı düzeltin, **ardından**
  `supabase/migrations/000N_fix_rls.sql` olarak repoya yazın ki kalıcı olsun.
* `SECURITY.md`'deki "✅ RLS on all tables" iddiası ancak bu denetimden sonra
  doğrulanmış sayılır.

### Sonuç tablosu (doldurun)

| # | Deneme | Sonuç | Tarih | Not |
|---|---|---|---|---|
| 1 | anonim INSERT | ☐ reddedildi ☐ **AÇIK** | | |
| 2 | anonim UPDATE | ☐ reddedildi ☐ **AÇIK** | | |
| 3 | DELETE | ☐ reddedildi ☐ **AÇIK** | | |
| 4 | `profiles.role` yazma | ☐ reddedildi ☐ **AÇIK** | | |
| 5 | `profiles` INSERT | ☐ … | | |
| 6 | başkasının owner'ıyla INSERT | ☐ … | | |
| 7 | başkasının fotoğraf yolu | ☐ … | | |
| 8 | `site_visits` INSERT | ☐ izinli (beklenen) | | |
| 9 | onaylı SELECT | ☐ izinli (beklenen) | | |
| 11 | İstemcide ayrıcalıklı anahtar | Kaynak regresyon testi | 2026-10-19 | src JS ve index içinde service_role JWT / secret key literal denetimi; Git geçmişi denetimi değildir |
| 10 | onay bekleyen SELECT | Satırlar filtrelendi | 2026-10-19 | Anon GET, id alanı, limit 1: HTTP 200, 0 satır |
| 12 | `data_requests` SELECT | Satırlar filtrelendi | 2026-10-19 | Anon GET, id alanı, limit 1: HTTP 200, 0 satır |

## Salt okunur denetim — 19 Ekim 2026

Canlı pg_tables/pg_policies katalogları okundu: public şemasındaki 13 tablonun ve incelenen tüm storage tablolarının RLS bayrağı açık. measurements yazma politikaları authenticated rolüne ve sahiplik/aktiflik koşullarına bağlı; data_requests okumaları sahip/yönetici kapsamlı; profiles ekleme politikası anon için mevcut değil. Bu sonuçlar katalog incelemesidir, tüm yetkilendirme senaryolarının davranışsal ispatı değildir.

Yukarıdaki yazma senaryoları canlıda çalıştırılmadı; mevcut boş kutular tamamlanmış gibi işaretlenmedi. Özellikle fotoğraf yolu ve iki gerçek kullanıcının karşılıklı erişimi için izole test gerekir. site_visits anonim INSERT izni tasarım gereğidir; denemek için yapay ziyaret eklenmedi. Canlıda oluşturulan denetim satırı: 0.

Eski `rls-probe.sh` POST/PATCH/DELETE içerir ve başarılı olursa veri yazabilir; salt okunur betik değildir. Üretim öncesi kontrol için otomatik çalıştırılmamalıdır.

İki anonim REST GET kontrolü de HTTP 200 ve boş dizi verdi. Bu, ilgili anda bu iki sorgunun veri döndürmediğini gösterir; boş tablo ile satır filtrelemesini tek başına ayıramaz. Katalogdaki rol/sahiplik koşulları ayrıca incelendi. Gerçek kayıt içerikleri raporlanmadı.
