# 📦 Yeni sürüm yayımlama (GitHub Release + Zenodo)

DendroGeo'nun bilimsel atıf alabilmesi için her anlamlı sürüm **Zenodo'da
arşivlenir** ve kendi DOI'sini alır. Zenodo bunu GitHub Release'lerinden
**otomatik** üretir — yani asıl iş GitHub'da bir Release yayımlamaktır.

> Süre: ~10 dakika · Ücret: yok · Kod değişikliği: yok (yalnız sürüm numaraları)

---

## 0) Ön koşul (bir kez yapılır)

Zenodo ↔ GitHub entegrasyonu açık olmalı:

1. <https://zenodo.org/> → **Log in with GitHub**
2. Üst menü → **GitHub** → listede `snansrin/dendrogeo` → **ON**
   (Zenodo, depoya release webhook'u eklemek için yetki ister)
3. Depoda ilk release yayımlandığında Zenodo otomatik olarak:
   * bir **kavram DOI** (concept DOI) oluşturur → her zaman en güncel sürüme
     çözümlenir: `10.5281/zenodo.22646300`
   * her release için bir **sürüm DOI**'si üretir: `10.5281/zenodo.XXXXXXX`

> Kavram DOI'yi README/JSON-LD/CITATION.cff'te kullanmaya devam edin; sürüm
> DOI'sini o sürüme atıf yaparken kullanın.

---

## 1) Sürüm numarasını belirle (SemVer)

| Değişiklik | Artış |
|---|---|
| Veri tabanı şeması değişti, lisans değişti, geriye dönük uyumsuz API | **MAJOR** (3.0.0 → 4.0.0) |
| Yeni özellik, geriye uyumlu | **MINOR** (3.0.0 → 3.1.0) |
| Hata düzeltmesi | **PATCH** (3.0.0 → 3.0.1) |

## 2) Sürüm numaralarını TEK KOMUTLA güncelle

Sürüm yedi yerde geçiyor; `test/release.test.mjs` hepsinin **aynı** olduğunu
kilitliyor (biri unutulursa CI kırmızı yanar):

| Dosya | Alan |
|---|---|
| `package.json` | `version` |
| `manifest.json` | `version` |
| `CITATION.cff` | `version` + `date-released` |
| `partials/head.html` | JSON-LD `softwareVersion` + `dateModified` |
| `partials/landing.html` | footer `vXX.X` |
| `SECURITY.md` | Supported Versions tablosu |
| `kunye/index.html` | Künye tablosundaki Sürüm satırı |

```bash
# örn. 3.1.0'a geçiş (yedi dosyayı birden günceller)
NEW=3.1.0; OLD=3.0.0; TODAY=$(date +%F)
sed -i "s/\"version\": \"$OLD\"/\"version\": \"$NEW\"/" package.json manifest.json
sed -i "s/^version: \"$OLD\"/version: \"$NEW\"/; s/^date-released: .*/date-released: \"$TODAY\"/" CITATION.cff
sed -i "s/\"softwareVersion\": \"${OLD%.*}\"/\"softwareVersion\": \"${NEW%.*}\"/" partials/head.html
sed -i "s/v${OLD%.*} ·/v${NEW%.*} ·/" partials/landing.html
sed -i "s/| ${OLD%%.*}\.0\.x  | ✅ Current         |/| ${NEW%%.*}.0.x  | ✅ Current         |/" SECURITY.md
sed -i "s/v${OLD%.*} (arayüz)/v${NEW%.*} (arayüz)/" kunye/index.html
npm run build && npm run check
```

> `partials/head.html`'deki `dateModified` alanını da güncelleyin
> (`"dateModified": "YYYY-AA-GG"`).

## 3) CHANGELOG.md

`## [XX.YY.Z] — YYYY-AA-GG` başlığı altında **Eklendi / Değişti / Düzeltildi /
Güvenlik** bölümleriyle yazın. Zenodo sürüm açıklaması olarak GitHub Release
notlarını kullanacağı için, release gövdesine CHANGELOG'un ilgili bölümünü
yapıştırmak en pratik yol.

## 4) Migration varsa

1. `supabase/migrations/000N_*.sql` — **idempotent** yazın
   (`create … if not exists`, `drop … if exists`, `create or replace`)
2. `supabase/README.md` tablosuna satır ekleyin + "Nasıl uygulanır" sırasını güncelleyin
3. Tam kurulum dosyasını yeniden üretin (0001→000N tek parça):
   `dendrogeo-tam-kurulum.sql`
4. Yerel PostgreSQL'de doğrulayın (Supabase stub'larıyla): zincir iki kez
   hatasız çalışmalı, RLS gerçek rollerle test edilmeli

## 5) Kontrol

```bash
npm run check      # sözdizimi + ?v= hash + index.html==partials + CSP + tüm testler
```

## 6) GitHub Release

1. `git push origin main` → CI'ın yeşil olduğunu görün
   (<https://github.com/snansrin/dendrogeo/actions>)
2. GitHub → **Releases** → **Draft a new release**
3. **Choose a tag** → `v3.0.0` yazın → **Create new tag on publish**
4. **Release title:** `DendroGeo v3.0.0 — park kimliği, Google girişi, yasal uyum`
5. **Describe this release:** `CHANGELOG.md`'nin ilgili bölümünü yapıştırın
   (veya **Generate release notes** ile otomatik commit listesi)
6. ✅ **Set as the latest release** · ☐ Pre-release (normal sürümde işaretleme)
7. **Publish release**

## 7) Zenodo tarafı

Release yayımlandıktan birkaç dakika sonra:

1. <https://zenodo.org/> → **Upload** → `snansrin/dendrogeo` deposunu görün
2. Yeni sürüm otomatik oluşur; **metadata `CITATION.cff`'ten alınır**
   (başlık, yazarlar, lisans, anahtar kelimeler, sürüm, tarih)
3. Kontrol edin:
   * **Upload type:** Software
   * **License:** CC BY-NC 4.0
   * **Authors:** Nagihan ŞİRİN, Sinan ŞİRİN (+ ORCID varsa profiller eşleşir)
   * **Related identifiers:** DOI (kavram DOI'si), repository URL
   * **Description:** `CITATION.cff`'teki `abstract`
4. Eksik varsa düzenleyin → **Save** → sürüm yayımlanır ve **yeni sürüm DOI'si**
   görünür (`10.5281/zenodo.XXXXXXX`)

## 8) Yayım sonrası

- [ ] Yeni sürüm DOI'sini `CHANGELOG.md` ve (isterseniz) README'ye ekleyin
- [ ] Canlı sitede `Ctrl+Shift+R` ile sürümün geldiğini doğrulayın
      (footer'da `vXX.X`, `sw.js` yeni CACHE_VERSION)
- [ ] Yeni migration varsa Supabase'de çalıştırın ve doğrulama sorgularını koşun
- [ ] Zenodo'nun kavram DOI'sinin en güncel sürüme çözümlendiğini kontrol edin:
      <https://doi.org/10.5281/zenodo.22646300>

---

## Sık yapılan hatalar

| Hata | Sonuç | Çözüm |
|---|---|---|
| Zenodo entegrasyonu kapalıyken release yayımlamak | Arşiv oluşmaz | Release'i silip entegrasyonu açın, yeniden yayımlayın |
| Sürüm numaralarının bir kısmı güncellenmemiş | `test/release.test.mjs` CI'da kırmızı | 2. adımdaki komutu kullanın |
| `index.html` elle düzenlenmiş | `build:check` kırmızı | `npm run build` (veya `--split`) |
| `sw.js` CACHE_VERSION artırılmamış | Kullanıcılar eski önbelleği görebilir | Modül kümesi değiştiyse sürümü artırın |
| `CITATION.cff` bozuk YAML | Zenodo metadata'yı alamaz | <https://citation-file-format.github.io/validate.html> |
| Tag ile `CITATION.cff` sürümü farklı | Atıflarda sürüm karışıklığı | İkisini aynı adımda güncelleyin |
