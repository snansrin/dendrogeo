# DendroGeo — Yüzey Analiz Sistemi Kod Kilidi

**Kilit kimliği:** `DG-SURFACE-LOCK-2026-10-08`  
**Kullanıcı tarafından çalışan kabul edilen referans commit:** `f6a68b7b5fe075ce280bd566d04d5e021e0dba9a`  
**Kurtarma dalı:** `recovery/surface-engine-locked-2026-10-08`  
**Manifest:** `docs/surface-engine-lock.json` — **33 dosya**, Git blob SHA-1 içeriğine göre sabit.

## Değiştirilemeyen (kullanıcı açıkça istemedikçe)

1. **Hassasiyet barları:** başlangıç değerleri, eşikler, sınıf geçişleri, yeşil/sert/su/çıplak kararları, hücre öncelikleri, tarama dönemleri ve tarama denetimleri.
2. **Analiz motoru:** ESA WorldCover temel sınıfları, 10 m kısmi hücre alan hesapları, maskeleme, UTM/geo matematiği, Sentinel-2 gözlemleri, OSM su/yol/bina/nesne geometrileri, ağ hata politikaları.
3. **Harita ve saha akışı:** park algılama, sınır çizme/seçme, fırça ve geri alma, grid/waypoint, sınıflandırma kaydı, görselleştirme, dışa aktarma ve analiz rapor ekranı.
4. **İlgili tasarım:** analiz ekranı, barlar, panel düzenleri, CSS tema ve düğme davranışları. Diğer sayfaların geliştirilmesi bu kilidin kaldırılması için gerekçe sayılmaz.

**Kilit kullanıcı arayüzünü devre dışı bırakmaz.** Barlar normal biçimde ayarlanabilir; `Tara`, manuel düzeltme, geri alma ve kaydetme işlevleri çalışmaya devam eder. Kilit yalnızca uygulamanın **kaynak kodu davranışını** sabitler. Kaydedilmiş kullanıcı taslakları, Supabase kayıtları, fotoğraflar ve yayımlanmış raporlar bu işlemle değiştirilmez.

## Nasıl denetlenir?

```bash
npm run check:surface-lock
npm run check
```

- Kontrol aracı, manifestin *kendisinin* sabit Git blob SHA'sını da ayrı bir kod sabitiyle doğrular. Manifestteki dosya listesini veya hash'leri sessizce değiştirmek testi geçirmez.
- 33 dosyadan biri değişmiş veya silinmişse CI kırmızı olur. Kilit **kaynak dosyaları otomatik geri yazmaz** ve kullanıcı verisine dokunmaz.
- `.github/CODEOWNERS`, korunan dosyalara `@snansrin` onayı önerir; GitHub'da zorunlu code-owner incelemesi etkin değilse bu tek başına engel değildir.
- Regresyon testi `test/surface-engine-lock.test.mjs`, hem sağlam kodu hem de örnek bir değişiklik/silme girişiminin reddedilmesini doğrular.

## GitHub korumasının sınırı

Bu depo bağlantısında GitHub'ın yönetim düzeyi branch-protection/ruleset yazma izni bulunmadığından yönetici düzeyinde **değiştirilemezlik** uygulanmamıştır. Repo sahibi veya yetkili biri kilit denetim dosyasını ve CI iş akışını da değiştirebilir; buna rağmen değişiklikler Git geçmişinde iz bırakır. Bu sebeple "hiç kimse değiştiremez" vaadi yapılmaz.

Zorunlu koruma için GitHub **Settings → Rules → Rulesets** veya branch protection üzerinden `main` için PR, kod sahibi onayı ve başarılı **Sözdizimi + CSP + testler + dağıtım denetimi** kontrolü gerekli hale getirilmelidir. **Önemli:** Mevcut rapor yayın botu `rapor/` dosyalarını doğrudan `main` dalına gönderiyor. Genelleştirilmiş "her push için PR" kuralı bu akışı kırabilir. Rapor botunun işleyişi test edilmeden böyle bir ayar açılmamalı; mümkünse korunan yollara özel kural veya güvenli bot istisnası tasarlanmalıdır. CI koruması, zorunlu status check yapılmadan yalnızca kontrol ve uyarıdır.

## Açık onay olmadan kilidi güncelleme

Korunan dosyalarda bir hata bulunursa dahi otomatik çözüm olarak algoritmayı değiştirme veya kilit dosyasını yeniden üretme. Önce kullanıcıya etki/riski bildir ve **açık onay iste**. Onaydan sonra ayrı dal, tek amaçlı diff, Göksu–Başkent Millet Bahçesi–Kuğulu Parkı regresyonları, `npm run check`, mobil test, harita/su alanı/rapor karşılaştırmaları ve CI doğrulaması gerekir.

Kurtarma için **tam SHA** kullanılmalıdır; recovery dalına commit eklenmez. `git reset --hard`, `push --force`, veritabanı temizleme, onaylı yüzey kaydını veya DOI raporunu değiştirme yasaktır. Kilidin kaldırılması gerektiğinde yeni sürüm için kullanıcı onaylı **yeni manifest ve kilit kimliği** üretilir; eski manifest ve commit geçmişi saklanır.
