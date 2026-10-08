# Analiz motoru kurtarma

## Kilitli sürüm

- Kilit: DG-SURFACE-LOCK-2026-10-09-R2
- Motor ve GIS temel commit'i: e1ef75ba98a480880b50af2a82ecca8897cd25a7
- Kilitli dosya/modül sayısı: 51
- Tam depo kurtarma dalı: recovery/analysis-engine-20261009

Yüzey analizi, raster/uydu kanıtı, OSM vektörleri, projeksiyon/geometri, grid, worker, GIS arayüz bağlantıları ve bunların regresyon testleri docs/surface-engine-lock.json içinde dosya bazında SHA-1 Git blob imzalarıyla sabitlenir. npm run check:surface-lock bu imzaları doğrular; npm run check aynı kilidi yayın kontrolünde çalıştırır. Kilitli motor dosyalarında değişiklik, yalnızca yeni ve açıkça onaylanmış bir motor sürümüyle yapılabilir.

## Tam kaynak depo yedeği

recovery/analysis-engine-20261009 dalı kilit yayımlandıktan sonra oluşturulacak; kilit dosyası dahil deponun tüm takip edilen dosyalarını ve Git geçmişini saklayacaktır. GitHub bu dalın kaynak arşivini şu adresten sunar:

https://github.com/snansrin/dendrogeo/archive/refs/heads/recovery/analysis-engine-20261009.zip

Geri yüklemek için depoyu klonlayıp git switch --detach recovery/analysis-engine-20261009 çalıştırın. Değişiklikleri ana dala almadan önce yeni dal açın; npm ci, npm run check ve npm run check:surface-lock kontrollerini çalıştırın. Ana dalı geçmişe zorla taşımayın.

## Yedek kapsamı

Bu yedek deponun takip edilen kaynak kodunu, testlerini, belgelerini, yapılandırmalarını ve varlıklarını kapsar. Canlı Supabase kayıtları/Storage, hesap sırları ve harici Sentinel-2/OSM servislerinin değişken verisi Git deposunda bulunmaz ve bu kaynak yedeğine dahil değildir.
