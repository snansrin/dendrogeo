# Sürüm yayımlama: GitHub Release ve Zenodo

Güncel yazılım: **3.0.1** · sürüm DOI: **10.5281/zenodo.22948773** · kavram DOI: **10.5281/zenodo.22646299**. Önceki sürüm 3.0.0: 10.5281/zenodo.22948643. Kavram DOI, Zenodo'daki aynı sürüm ailesinin bütün sürümlerini temsil eder; tam tekrar üretme için sürüm DOI'si kullanılır.

## 1. Hazırlık

- Kapsamı ve tüm değişiklikleri `CHANGELOG.md` ve `docs/releases/` içinde kaydedin. Tag aralığındaki commit listesini ekleyin.
- `package.json`, `package-lock.json`, `manifest.json`, `CITATION.cff`, `partials/head.html` JSON-LD ve güncel site atıflarını eşitleyin. Patch numarası dahil tam sürümü gösterin.
- `CITATION.cff` yazar sırası, ORCID, başlık, MIT yazılım lisansı ve yayın tarihini taşımalıdır. Ayrı `.zenodo.json` varsa Zenodo onun metadata'sını kullanır; iki kaynağı farkında olmadan birlikte sürdürmeyin.
- Dondurulmuş DGR raporlarını ve tarihsel kaynak sürümü atıflarını topluca değiştirmeyin. Yazılım DOI'si veri DOI'si değildir.

## 2. DOI ayırma ve dosyalar

Tercih edilen, dosyaların kendi DOI'sini içerebildiği akış:

1. Zenodo'da mevcut yazılım kaydını açın → **Manage record → New version**.
2. **Get a DOI now!** ile yeni DOI'yi ayırın. Ayrılmış DOI yayına kadar tescil edilmez.
3. Yeni DOI'yi güncel README/BibTeX, CITATION.cff, landing, JSON-LD, künye, NOTICE ve güncel yazılım atfı üreten modüllere işleyin. Kavram DOI'yi ayrı belirtin.
4. Eski sürüm dosyasını içeri aktarmak yerine yeni doğrulanmış sürümün kaynak arşivini yükleyin. Arşiv kimliği, kaynak commit, SHA-256 ve sürüm notları birlikte kaydedilsin.
5. Yeni kaydın türü Software, sürümü tam SemVer, yayın tarihi ve yazarları doğru olmalı. Yazılım lisansı MIT; paketteki veri/özgün içerik ve üçüncü tarafların kapsamı NOTICE ile açıklanmalı.

GitHub entegrasyonu da kullanılabilir: **Releases → Draft a new release** ile yayımlanan release, entegrasyon açıksa otomatik arşivlenir. Elle oluşturulan aynı sürüm taslağı varken ikinci bir otomatik Zenodo kaydı üretmeyin. Entegrasyon durumunu kontrol edin; ihtiyaç varsa mevcut taslağı tamamlayın. Tag ile arşiv dosyalarının aynı içeriğe ait olduğunu doğrulayın.

## 3. Kabul ve yayın

```sh
npm ci
npm run build
npm run check
npm run check:phone
npm run check:accessibility
```

`test/release.test.mjs` sürüm ve DOI tutarlılığını sınar. Çekirdek kilitli dosyalarda yalnız yetkili sürüm/atıf/generasyon değişiklikleri varsa kapsam ve önceki/yeni hash zinciri ayrıca kaydedilir; hesaplama motorları bu iş için değiştirilmez.

PR/CI başarılı olduktan sonra main'e birleştirin. `vX.Y.Z` tag'i aynı doğrulanmış kaynak commit'ine bağlanmalı. GitHub Release notlarına `docs/releases/` özeti ve tam değişiklik bağlantıları ekleyin. Zenodo'ya aynı tag'in arşivini yükleyip yayımlayın.

## 4. Yayın sonrası

- DOI çözümleyicisi ve Zenodo kaydında sürüm, dosyalar, lisans ve yazarları doğrulayın.
- GitHub Release/tag ve kaynak arşivini eşleştirin.
- Canlı `index.html`, runtime, site atfı ve service worker'ın beklenen sürümle eşleştiğini kontrol edin.
- Bir sürüm için DOI ayırmak tek başına yayını tamamlamaz. Yayın engeli varsa taslak/yayın durumu açıkça bildirilir.

Resmi kaynaklar: [Zenodo sürümleme](https://help.zenodo.org/docs/deposit/manage-versions/), [DOI ayırma](https://help.zenodo.org/docs/deposit/describe-records/reserve-doi/), [CITATION.cff desteği](https://help.zenodo.org/docs/github/describe-software/citation-file/).
