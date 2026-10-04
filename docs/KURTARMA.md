# DendroGeo saha çekirdeği — 4 Ekim 2026

> **Güncel ana çekirdek:** Kullanıcının 4 Ekim 2026 tarihli kararıyla `recovery/core-2026-10-04` dalı `61d4163a0a6d9d62d6b5f4f623894a6c9b57e29a` commit'ine fast-forward edilmiştir. Önceki `e7d94399aa6a058538068b6e4cc0263ed68ffa34` kurtarma noktası `recovery/previous-core-e7d9439` dalında ayrıca korunur. Aşağıdaki doğrulama manifesti önceki e7d9439 anlık görüntüsünü denetler; güncel çekirdek davranışı ve kırmızı çizgiler için [CORE-KIRMIZI-CIZGILER.md](CORE-KIRMIZI-CIZGILER.md) ve [ANALIZ-TEK-MOTOR-2026-10-04.md](ANALIZ-TEK-MOTOR-2026-10-04.md) belgelerini kullanın.

Kullanıcının sahada çalışmayı sürdürmek için kabul ettiği sürüm GitHub'da ayrı bir kurtarma dalına sabitlenmiştir.

| Referans | Değer |
|---|---|
| Kurtarma dalı | `recovery/core-2026-10-04` |
| Kesin commit | `e7d94399aa6a058538068b6e4cc0263ed68ffa34` |
| Git ağacı | `e88dc1d5d22eafb8e581413004bb2fc7314cad98` |
| Test | 1.221 test başarılı; PR #16 CI ve Pages başarılı |
| Canlı dosya denetimi | Değişen 10 çalışma dosyası SHA-256 karşılaştırmasında eşleşti |
| Gerçek veri kontrolü | Göksu Parkı, 7.864 raster hücresi; 20,1 saniye; alan farkı %0,196 |

Bu dal geliştirme hedefi değildir. Üzerine commit eklenmemeli, silinmemeli veya zorla güncellenmemelidir. Dal koruması otomatik kurulmamıştır; geri dönüşte dal adı yerine yukarıdaki kesin commit kullanılmalıdır. `recovery-core-2026-10-04.json`, 83 çalışma dosyasının SHA-256 değerlerini içerir.

## Önce doğrula

```bash
git fetch origin recovery/core-2026-10-04
node scripts/check-recovery.mjs
```

Bu komut yalnız Git nesnelerini okur; çalışma dosyalarını, veritabanını, tarayıcı kuyruğunu ve yayınları değiştirmez.

## Ayrı çalışma alanında kurtarma sürümünü aç

```bash
git fetch origin recovery/core-2026-10-04
git worktree add --detach ../dendrogeo-recovery e7d94399aa6a058538068b6e4cc0263ed68ffa34
cd ../dendrogeo-recovery
npm ci
npm run check
```

Kurtarma sürümünün testleri bağımsız çalışma alanında çalıştırılır. Ana çalışma alanında `reset --hard`, zorla push veya veritabanı geri yüklemesi yapılmaz.

## Sorun olduğunda yayın akışı

1. Sorunun başladığı commit belirlenir. Güncel `main` üzerinden yeni bir düzeltme dalı açılır.
2. Hatalı değişiklik hedefli biçimde geri alınır. Tüm siteyi geri almak gerekiyorsa çekirdekle güncel sürümün farkı incelenir; sonraki saha verileri ve yayımlanmış rapor dosyaları korunur.
3. Çalışma dosyaları değiştiğinde `sw.js` önbellek sürümü güncel sürümden ileri taşınır ve `npm run build` çalıştırılır. Eski önbellek numarasını aynen geri getirmek yeni sürüme geçişi bozabilir.
4. İlgili regresyonlar, `npm run check`, 360/390/430 px telefon görünümü ve CI doğrulanır. PR üzerinden `main`'e birleştirilir; Pages tamamlanınca canlı dosyalar hash ile kontrol edilir.
5. Park algılama, yüzey analizi ve çevrimdışı ölçüm senkronizasyonu kullanıcının gerçek oturumunda doğrulanır. Oturum/bot koruması değiştirilmez.

## Kurtarma kapsamı ve kırmızı çizgiler

Sonradan uygulanan sunucu güvenlik düzeltmeleri kod kurtarması sırasında kaldırılmaz. Özellikle `profile_privilege_guard`, eski çekirdeğe dönüşte de etkin kalır.

Git kurtarma noktası kodu ve o tarihte repoda bulunan dosyaları saklar. Supabase veritabanı, Storage fotoğrafları, kullanıcı hesapları, GitHub Secrets ve cihazın IndexedDB kuyruğu bu yedeğin kapsamına girmez. Bunları geri almak farklı bir işlemdir ve bu belge böyle bir işlem çalıştırmaz.

- Tema, yazı aileleri, buton özellikleri ve durum renkleri korunur.
- DBH santimetre cinsinden çaptır. Allometri formülleri ve saha ölçümleri değiştirilmez.
- Ham raster, kabul edilmiş yüzey geometrisi, alanlar ve raporların bilimsel bütünlüğü korunur; hedef alan değerlerine zorlanmaz.
- Rapor, DOI, profil ve yetkiler kurtarma bahanesiyle sıfırlanmaz.
- Çevrimdışı bekleyen ölçümler, başarısız istek veya oturum değişiminde silinmez.
- Sahada çalışan sürüm üzerinde kapsamlı refaktör veya yeni özellik denemesi yapılmaz.
