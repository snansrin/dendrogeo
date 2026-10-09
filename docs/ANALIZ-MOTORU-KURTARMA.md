# Analiz motoru kurtarma

## Önceki temel ve kurtarma kaydı

- Eski kilit kaydı: DG-SURFACE-LOCK-2026-10-09-R2 (kaldırıldı)
- Motor ve GIS temel commit'i: e1ef75ba98a480880b50af2a82ecca8897cd25a7
- Önceki snapshot dosya/modül sayısı: 54
- Tam depo kurtarma dalı: recovery/analysis-engine-20261009

`docs/surface-engine-lock.json` önceki motor temelinin hash listesini ve kurtarma referansını arşiv olarak saklar. Kullanıcının 2026-10-09 tarihli talimatıyla kaynak kilidi ve CI hash denetimi kaldırılmıştır; analiz motorunun modüllerine artık mimari çalışma kapsamında müdahale edilebilir. Eski hash'ler yalnızca geçmişteki dosya içeriklerini tanımlar, güncel kodu doğrulamaz.

## Tam kaynak depo yedeği

`recovery/analysis-engine-20261009` dalı deponun takip edilen dosyalarını ve Git geçmişini saklayan kurtarma noktasıdır. GitHub bu dalın kaynak arşivini şu adresten sunar:

https://github.com/snansrin/dendrogeo/archive/refs/heads/recovery/analysis-engine-20261009.zip

Geri yüklemek için depoyu klonlayıp `git switch --detach recovery/analysis-engine-20261009` çalıştırın. Değişiklikleri ana dala almadan önce yeni dal açın; `npm ci` ve `npm run check` kontrollerini çalıştırın. Ana dalı geçmişe zorla taşımayın.

## Yedek kapsamı

Bu yedek deponun takip edilen kaynak kodunu, testlerini, belgelerini, yapılandırmalarını ve varlıklarını kapsar. Canlı Supabase kayıtları/Storage, hesap sırları ve harici Sentinel-2/OSM servislerinin değişken verisi Git deposunda bulunmaz ve bu kaynak yedeğine dahil değildir.
