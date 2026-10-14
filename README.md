# 🌲 DendroGeo

**Küresel Ağaç Envanteri ve Karbon Veri Sistemi.** DendroGeo; saha ağaç ölçümlerini, biyokütle ve karbon tahminlerini, detaylı park analizlerini, göreceli NDVI çıktılarını, DOI atanabilir raporlamayı ve interaktif harita paylaşımını tek bir Web GIS/PWA çatısı altında birleştiren açık kaynaklı bir sistemdir.

🌐 [DendroGeo sitesi](https://dendrogeo.org/) · [Ağaç envanteri](https://dendrogeo.org/agac-envanteri/) · [Karbon hesabı](https://dendrogeo.org/karbon-hesaplama/) · [Arazi örtüsü](https://dendrogeo.org/arazi-ortusu/) · [Kent parkları](https://dendrogeo.org/kent-parklari/) · [Yöntem](https://dendrogeo.org/yontem/) · [Rapor arşivi](https://dendrogeo.org/rapor/)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22948643.svg)](https://doi.org/10.5281/zenodo.22948643)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![CI](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml/badge.svg)](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml)

---

## 🚀 Sitede Neler Var?

DendroGeo, hem saha operasyonlarını kolaylaştıran hem de akademik standartlarda veri üreten modüler bir yapıya sahiptir:

- **Akıllı Saha Envanteri (PWA):** GPS konumu, 1,30 m'den ölçülen göğüs çevresi, boy, tür/grup ve isteğe bağlı fotoğraf. Sistem DBH çapını `D = C / π` ile türetir. Fotoğraf eklendiğinde tarayıcı içi QA/QC uygulanır. Ölçümler çevrimdışı kuyruğa alınabilir ve bağlantı gelince otomatik eşitlenir.
- **Gelişmiş Park ve Arazi Örtüsü Analizi:** ESA WorldCover 2021 (10 m) raster verisi park sınırıyla kesiştirilerek; ağaç, çalı, otsu bitki ve yapay yüzey gibi sınıfların gerçek kesişim alanları üzerinden hassas yüzdesel dağılımı hesaplanır.
- **Göreceli NDVI Çıktısı:** Sentinel-2 uydu verileri üzerinden Normalleştirilmiş Farklılaşma Bitki Örtüsü Endeksi (NDVI) hesaplanarak park içindeki bitki sağlığı, gölgelik yoğunluğu ve potansiyel stres bölgeleri görselleştirilir.
- **Canlı Harita ve Paylaşım:** Yönetici onaylı ölçümleri; park sınırı, gridler ve waypoint katmanlarıyla birlikte interaktif olarak görüntüleme. Harita çıktıları QR kodu veya kalıcı URL ile paydaşlarla kolayca paylaşılabilir.
- **DOI Atanabilir Akademik Raporlama:** Park raporları, DGR (DendroGeo Raporu) kimliği ve SHA-256 içerik parmak iziyle arşivlenir. Raporlar değiştirilemez (immutable) formattadır ve Zenodo gibi platformlarla entegre DOI atanarak akademik yayına hazır hale getirilir.
- **Projeler ve İşbirliği:** Aynı fiziksel parkta çalışan farklı projeler, park kimliği altında karşılaştırılabilir. "Park çalışma arkadaşı" akışı, ortak saha ölçümlerini ve veri girişini destekler.
- **Esnek Dışa Aktarım:** Veriler, ileri analizler için CSV, GeoJSON ve QGIS (fotoğraf eşleştirmeli) biçimlerinde doğrulanmış olarak dışa aktarılabilir.

---

## 🔬 Veri ve Yöntem

### Ağaç Biyokütlesi ve Karbon
Üstü gövde biyokütlesi (AGB), uluslararası literatürde kabul görmüş **Chave vd. (2014)** allometrik modeliyle hesaplanır:

`AGB = 0.0673 · (ρ · D² · H)^0.976`

- **C:** Saha değişkeni, göğüs çevresi (cm).
- **D:** `D = C / π` ile türetilen DBH çapı (cm). Ham çevre korunur; allometriye çevre değil, tam hassasiyetli türetilmiş `D` girer. Arayüzde 1 ondalık basamak gösterilir.
- **H:** Ağaç boyu (m).
- **ρ (rho):** Odun yoğunluğu (g/cm³). Tür yoğunluğu bulunmadığında belgelenmiş grup varsayımı uygulanır.

Kök biyokütlesi `AGB × 0,26` olarak; toplam karbon stoğu ise toplam biyokütlenin (AGB + Kök) `0,47`'si (IPCC standartları) olarak tahmin edilir. **Önemli:** Bunlar doğrudan ölçülmüş karbon miktarı değil, model tabanlı tahminlerdir. Uygulama ve raporlar, belirsizlik sınırlarını ve yöntem kısıtlarını şeffaf bir şekilde açıklar.

### Park Arazi Örtüsü
- **Birincil Kaynak:** ESA WorldCover 2021 v200, 10 m çözünürlük.
- **Bağımsız Çapraz Kontrol:** Impact Observatory LULC 2020.
- **Hesaplama:** Alan hesabı, raster hücrelerinin park geometrisiyle gerçek kesişim alanlarını kullanır. Bilinmeyen veya kapsam dışı alanlar hedef yüzdelere keyfi olarak dağıtılmaz.
- **Not:** OSM park/yapı/geometri bilgileri yardımcı katmandır; ham raster sınıfının yerine geçmez. Ayrıntı için: [Yöntem Belgesi](docs/methods.md) ve [Arazi Örtüsü Yöntemi](docs/LULC_METHODOLOGY.md).

---

## 📑 Rapor Kimliği ve DOI

DGR, DendroGeo park raporunun kalıcı iç kimliğidir. Yayımlanan rapor sessizce değiştirilmez; düzeltme ve geri çekmeler kayıtlı, şeffaf bir yayın süreciyle yürütülür. Yayımlanan raporlar ve durumları [Rapor Arşivi](https://dendrogeo.org/rapor/) sayfasından izlenebilir.

> ⚠️ **ÖNEMLİ UYARI:** README başlığındaki Zenodo DOI, **yalnızca DendroGeo v3.0.0 yazılım sürüm kaydına** aittir. Bir park raporunun DOI'si, ancak o rapor için ayrıca atanmış ve yayımlanmışsa kullanılır; yazılım DOI'si, DGR rapor DOI'si veya saha verisi DOI'si olarak gösterilemez.

### Yazılım Atfı (BibTeX)
```bibtex
@software{dendrogeo,
  title   = {DendroGeo: Global Tree Inventory and Carbon Data System},
  author  = {\c{S}irin, Nagihan and \c{S}irin, Sinan},
  year    = {2026},
  version = {3.0.0},
  doi     = {10.5281/zenodo.22948643},
  license = {CC-BY-NC-4.0}
}

## UI değişiklikleri için kabul listesi

- Ham ölçüm `girth_cm`; DBH yalnız `girth_cm / π`. `measurement-protocol-lock.js` ve fingerprint bilimsel tek referanstır. UI `dbh_cm_display` 1 ondalık gösterir; kayıt/payload tam hassasiyeti taşır. `mDbh` yalnız eski DOM API uyumluluk kimliğidir, input adı `girth_cm`dir.
- Native `input.dg-switch`, anlamlı label, doğal tab sırası ve görünür odak kullanılır. Range kontrolleri `dg-range` ile sıfır padding ve en az 44 px dokunma alanına sahiptir.
- Mevcut tema değişkenleri ve font hiyerarşisi korunur. Görsel opacity/yumuşatma ham raster, alan ve kabul edilmiş snapshot’ı değiştirmez.
- Konum yalnız izin ve park paylaşım koşullarıyla geçicidir; yönetici filtreleri yetki veya RLS erişimi açmaz.
- `npm run check` kaynak/SQL/regresyon; `npm run check:phone` gerçek telefon etkileşimleri; `npm run check:accessibility` axe ve klavye/focus/range kontrolleridir. `npm run check:release` hepsini sırayla çalıştırır. Chromium bir kez `npx --yes --package=playwright@1.62.1 playwright install chromium` ile kurulur.
- Her PR CI kaynak ve telefon/erişilebilirlik kapılarını geçer. Rapor/DOI üretimi ve commit/push bu kabul kapısından sonra yapılır. Yayında runtime ve SW sürümü doğrulanır.
- DB değişikliği yeni, idempotent migration’dır; mevcut dosya veya tarihsel ölçümler değiştirilmez. SQL kontratı izole PostgreSQL’de çalıştırılır.

Kullanıcı tablosunun satır bazlı kanıtı: [Mimari kabul tablosu](docs/USER-ARCHITECTURE-TABLE-2026-10-14.md).
