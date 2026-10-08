# DendroGeo — Yüzey Analiz Sistemi Kod Kilidi

**Kilit kimliği:** `DG-SURFACE-LOCK-2026-10-08`  
**Kullanıcı tarafından doğrulanan su analizi referansı:** `7680cab4a7fd9102bef64e5cf031b740940a5be0` (önceki çekirdek: `f6a68b7b5fe075ce280bd566d04d5e021e0dba9a`)  
**Kurtarma dalı:** `recovery/surface-verified-water-20261008` (önceki kurtarma dalı da korunuyor)  
**Manifest:** `docs/surface-engine-lock.json` — **51 dosya**, Git blob SHA-1 içeriğine göre sabit.

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
- 51 dosyadan biri değişmiş veya silinmişse CI kırmızı olur. Kilit **kaynak dosyaları otomatik geri yazmaz** ve kullanıcı verisine dokunmaz.
- `.github/CODEOWNERS`, korunan dosyalara `@snansrin` onayı önerir; GitHub'da zorunlu code-owner incelemesi etkin değilse bu tek başına engel değildir.
- Regresyon testi `test/surface-engine-lock.test.mjs`, hem sağlam kodu hem de örnek bir değişiklik/silme girişiminin reddedilmesini doğrular.

## Sonuçların oluşma koşulları — bilimsel kayıt

**Makine tarafından denetlenen sözleşme:** [surface-scientific-contract.json](surface-scientific-contract.json). Bu dosya da kilitlidir; `test/surface-scientific-contract.test.mjs` kaynak koddan eşikleri doğrular.

- **Sabit ham kaynak:** ESA WorldCover 2021 v200, 10 m; sınıf kodları ve kısmi hücre–park alan kesişimi değiştirilmedi. Kabul edilen alan farkı QA sınırı %0,5.
- **İsteğe bağlı güncel spektral kanıt:** Copernicus Sentinel-2 L2A; STAC Planetary Computer, en fazla 6 sahne, sahne bulut örtüsü en çok %20; her hücrede en az üç farklı yeterli gözlem. Yılbaşından günümüze (`ytd`), son 120 gün (`latest`) veya referans yılın 1 Haziran–30 Eylül aralığı (`ref`) farklı veri pencereleridir.
- **Spektral eşikler:** MNDWI su ≥ 0,20; mevsimsel en yüksek su ≥ 0,45; suya ait taç/NDVI < 0,50. Yeşil NDVI ≥ 0,35; sert zemin IBI ≥ 0,0; çıplak NDVI ≤ 0,20. Sonuç yalnız bu tek eşiklerden değil, `lc-validate.js` içindeki tüm öncelik/kapsam kurallarından oluşur.
- **Bar varsayılanları:** Yeşil/Su/Sert/Çıplak 50/100. Barlar 0–100 kullanılabilir; başlangıç ve eşik eğimleri kilitlidir; kullanıcı değişiklikleri yalnız önizleme/düzeltme akışında etkili olur.
- **Su sınırı:** Göksu parkı OSM `way/423602737`, doğrulanmış göl `way/423602740` (kontrol tarihinde 411 koordinat köşesi). OSM çevrimiçi erişilemezse geçerli aynı park geometrisi saklanır; rastgele 10 m piksellerden göl sınırı üretilmez.
- **Kabul ve yayın:** Bilinmeyen raster-su artıkları keyfî biçimde yeşil/sert/çıplak sayılmaz; belirsizlik varsa kabul edilmez. Raporda kaydedilmiş kabul sonucu kullanılır; kaydedilmemiş önizleme yayın verisi olmaz.

**Tekrar üretilebilirlik koşulu:** Kod aynı olsa bile canlı STAC/OSM kaynakları güncellenebilir. *Aynı sayısal sonuç* için alan poligonu ve delikleri, ESA karosu ve içerik hash'i, Sentinel sahne ID/tarih/asset içerikleri, OSM nesne revizyonu, tarama anı/dönemi, bar değerleri, seçilmiş/çizilmiş tüm nesneler ve manuel hücre kararları da aynı olmalıdır. Mevcut kabul kaydı bu girdilerin bazılarını tutar, hepsinin ham byte arşivini tutmaz. Bu nedenle kilit tek başına geçmiş bir analizin her gelecekteki yeniden taramada bit düzeyinde aynı olacağını **garanti etmez**.

### Genişletilmiş koruma

Önceki 33 dosyaya ek olarak GeoTIFF/polygon-clipping/Leaflet kütüphaneleri, OSM su yedeği, Göksu parkı QA geometrisi, kaynak/doğruluk kontrol betikleri ve regresyon testleri sabitlenmiştir. Yeni CSS veya rapor/hesap dışı işlevler mevcut GIS kilidini kaldırmadan geliştirilebilir. Bu dosyalardan herhangi biri değişirse CI bütünlük kontrolü durur; hiçbir kullanıcı verisi otomatik geri yazılmaz.

## GitHub korumasının sınırı

Bu depo bağlantısında GitHub'ın yönetim düzeyi branch-protection/ruleset yazma izni bulunmadığından yönetici düzeyinde **değiştirilemezlik** uygulanmamıştır. Repo sahibi veya yetkili biri kilit denetim dosyasını ve CI iş akışını da değiştirebilir; buna rağmen değişiklikler Git geçmişinde iz bırakır. Bu sebeple "hiç kimse değiştiremez" vaadi yapılmaz.

Zorunlu koruma için GitHub **Settings → Rules → Rulesets** veya branch protection üzerinden `main` için PR, kod sahibi onayı ve başarılı **Sözdizimi + CSP + testler + dağıtım denetimi** kontrolü gerekli hale getirilmelidir. **Önemli:** Mevcut rapor yayın botu `rapor/` dosyalarını doğrudan `main` dalına gönderiyor. Genelleştirilmiş "her push için PR" kuralı bu akışı kırabilir. Rapor botunun işleyişi test edilmeden böyle bir ayar açılmamalı; mümkünse korunan yollara özel kural veya güvenli bot istisnası tasarlanmalıdır. CI koruması, zorunlu status check yapılmadan yalnızca kontrol ve uyarıdır.

## Açık onay olmadan kilidi güncelleme

Korunan dosyalarda bir hata bulunursa dahi otomatik çözüm olarak algoritmayı değiştirme veya kilit dosyasını yeniden üretme. Önce kullanıcıya etki/riski bildir ve **açık onay iste**. Onaydan sonra ayrı dal, tek amaçlı diff, Göksu–Başkent Millet Bahçesi–Kuğulu Parkı regresyonları, `npm run check`, mobil test, harita/su alanı/rapor karşılaştırmaları ve CI doğrulaması gerekir.

Kurtarma için **tam SHA** kullanılmalıdır; recovery dalına commit eklenmez. `git reset --hard`, `push --force`, veritabanı temizleme, onaylı yüzey kaydını veya DOI raporunu değiştirme yasaktır. Kilidin kaldırılması gerektiğinde yeni sürüm için kullanıcı onaylı **yeni manifest ve kilit kimliği** üretilir; eski manifest ve commit geçmişi saklanır.
