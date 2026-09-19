# migrations/

Bu dizin **boş** — `supabase/dump-schema.sh` çalıştırıldığında `0001_init.sql`
buraya yazılacak.

## Kural

Mevcut bir dosyayı **asla düzenlemeyin.** Her değişiklik yeni numaralı dosya:

```
0001_init.sql              ← şema dökümü (üretilmiş, elle düzenlenmez)
0002_audit_columns.sql     ← reviewed_by / reviewed_at / deleted_at
0003_allometry_version.sql ← allometry_version / rho_used / rho_source
0004_world_agg_view.sql    ← istatistikleri DB tarafına taşıyan view
0005_indexes.sql           ← status / lat / lon / owner indeksleri
```

Böylece her değişikliğin ne zaman, neden yapıldığı git geçmişinden okunabilir —
Supabase panelinde yapılan bir düzenlemenin izi yoktur.
