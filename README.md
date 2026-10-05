# 🌲 DendroGeo

**Küresel Ağaç Envanteri ve Karbon Veri Sistemi.** DendroGeo; saha ağaç ölçümlerini, biyokütle ve karbon tahminlerini, park kimliğini, canlı haritayı ve park ölçeğinde arazi örtüsü analizini bir web GIS/PWA içinde birleştirir.

🌐 [DendroGeo sitesi](https://dendrogeo.org/) · [Ağaç envanteri](https://dendrogeo.org/agac-envanteri/) · [Karbon hesabı](https://dendrogeo.org/karbon-hesaplama/) · [Arazi örtüsü](https://dendrogeo.org/arazi-ortusu/) · [Kent parkları](https://dendrogeo.org/kent-parklari/) · [Yöntem](https://dendrogeo.org/yontem/) · [Rapor arşivi](https://dendrogeo.org/rapor/)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22948643.svg)](https://doi.org/10.5281/zenodo.22948643)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![CI](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml/badge.svg)](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml)

## Sitede neler var?

- **Saha envanteri:** GPS konumu, göğüs yüksekliğinde ağaç çapı (DBH), boy, tür/grup ve isteğe bağlı fotoğraf. Fotoğraf eklendiğinde tarayıcı içi QA/QC uygulanır. Ölçümler çevrimdışı kuyruğa alınabilir ve bağlantı gelince eşitlenir.
- **Waypoint ve navigasyon:** proje noktalarını yükleme, sıralama ve sahada hedefe yönelme.
- **Canlı harita:** yönetici onaylı ölçümleri görüntüleme; katmanları, park sınırını, gridleri ve waypointleri inceleme; harita çıktısı alma.
- **Park yüzey analizi:** 10 m arazi örtüsü rasterını park sınırıyla kesiştirerek sınıf alanlarını hesaplama. Sentinel-2 taraması isteğe bağlıdır; yeni tarama nötr eşiklerden başlar ve kendi başına ham sınıfları yeniden etiketlemez. Hücre fırçası, elle hücre seçimi ve sınır çizimi kullanıcı kararlarını kaydeder.
- **Projeler ve parklar:** aynı fiziksel parkta çalışan projeler park kimliği altında karşılaştırılabilir. Park çalışma arkadaşı akışı ortak saha ölçümünü destekler.
- **Dünya verisi ve yönetim:** onaylı kayıtların harita/istatistik görünümü; moderasyon, kullanıcı ve ziyaretçi görünümü yönetim yetkileriyle sunulur.
- **Dışa aktarım ve raporlar:** CSV, GeoJSON, QGIS biçimleri ve doğrulanmış harita çıktıları; park raporları DGR kimliği ve içerik parmak iziyle arşivlenir.

## Veri ve yöntem

### Ağaç biyokütlesi ve karbon

Üstü gövde biyokütlesi Chave vd. (2014) allometrik modeliyle hesaplanır:

`AGB = 0.0673 · (ρ · D² · H)^0.976`

Burada `D` DBH (cm), `H` ağaç boyu (m), `ρ` odun yoğunluğudur. Kök biyokütlesi `AGB × 0,26`; karbon stoğu toplam biyokütlenin `0,47`'si olarak tahmin edilir. Tür yoğunluğu bulunmadığında belgelenmiş grup varsayımı uygulanabilir. Bunlar ölçülmüş karbon miktarı değil, model tabanlı tahminlerdir. Uygulama ve rapor belirsizlikleri ile sınırlılıkları açıklar.

### Park arazi örtüsü

- Birincil kaynak: **ESA WorldCover 2021 v200, 10 m**.
- Bağımsız çapraz kontrol: **Impact Observatory LULC 2020**.
- Alan hesabı, raster hücrelerinin park geometrisiyle gerçek kesişim alanlarını kullanır.
- OSM park/yapı/geometri bilgileri yardımcı katmandır; ham raster sınıfının yerine geçmez. Bilinmeyen veya kapsam dışı alanlar hedef yüzdelere dağıtılmaz.
- Sınıf sonuçları kaynak, yıl, geometri QA ve yöntem sınırlılıklarıyla yorumlanmalıdır. Ayrıntı: [yöntem belgesi](docs/methods.md) ve [arazi örtüsü yöntemi](docs/LULC_METHODOLOGY.md).

## Rapor kimliği ve DOI

DGR, DendroGeo park raporunun kalıcı iç kimliğidir. Yayımlanan rapor sessizce değiştirilmez; düzeltme ve geri çekmeler kayıtlı yayın süreciyle yürütülür. [Rapor arşivinde](https://dendrogeo.org/rapor/) yayımlanan raporlar ve durumları görülebilir.

README başlığındaki Zenodo DOI, **DendroGeo v3.0.0 yazılım sürüm kaydına** aittir. Bir park raporunun DOI'si ancak o rapor için ayrıca atanmış ve yayımlanmışsa kullanılır; yazılım DOI'si DGR rapor DOI'si olarak gösterilmez.
```bibtex
@software{dendrogeo,
  title   = {DendroGeo: Global Tree Inventory and Carbon Data System},
  author  = {\c{S}irin, Nagihan and \c{S}irin, Sinan},
  year    = {2026},
  version = {3.0.0},
  doi     = {10.5281/zenodo.22948643},
  license = {CC-BY-NC-4.0}
}
```

## Site sayfaları

| Sayfa | İçerik |
|---|---|
| [Ağaç Envanteri](https://dendrogeo.org/agac-envanteri/) | Saha ölçümü ve veri yaşam döngüsü |
| [Karbon Hesaplama](https://dendrogeo.org/karbon-hesaplama/) | Model, varsayımlar ve belirsizlik |
| [Arazi Örtüsü](https://dendrogeo.org/arazi-ortusu/) | Raster kaynakları, hücre alanı ve sınırlılıklar |
| [Kent Parkları](https://dendrogeo.org/kent-parklari/) | Park ölçeğinde veri kaynaklarının ayrımı |
| [Veri ve Dışa Aktarım](https://dendrogeo.org/veri/) | Kayıtların yönetimi, formatlar ve lisanslar |
| [Yöntem](https://dendrogeo.org/yontem/) · [English site](https://dendrogeo.org/en/) · [English methods](https://dendrogeo.org/en/methods/) | Bilimsel hesap zinciri |
| [Hakkımızda](https://dendrogeo.org/hakkimizda/) · [Künye](https://dendrogeo.org/kunye/) | Proje, sorumlular ve iletişim |
| [Gizlilik](https://dendrogeo.org/gizlilik/) · [KVKK Aydınlatma](https://dendrogeo.org/aydinlatma/) · [Kullanım Koşulları](https://dendrogeo.org/kullanim-kosullari/) | Yasal ve veri işleme bilgileri |

## Geliştirme

Site, GitHub Pages üzerinde yayımlanan statik bir web uygulaması/PWA'dır; kullanıcı ve proje verileri Supabase'e RLS politikalarıyla erişir. `index.html`, `partials/` içeriğinden üretilir. Geliştirme ortamı Node.js 20 veya üzerini gerektirir.

```bash
git clone https://github.com/snansrin/dendrogeo.git
cd dendrogeo
npm ci
npm run check
npm run build
python3 -m http.server 8080
```

`npm run check` sözdizimi, sürüm işaretleri, üretilen HTML, CSP ve testleri denetler. Test sayısı zamanla değişebildiğinden burada sabit sayı verilmez. Üretim öncesi kontrol ve dağıtım CI üzerinden yapılır.

## Lisans ve atıf

DendroGeo'nun hak sahiplerinin yayımlama yetkisine sahip olduğu özgün kaynak kodu, arayüzü, belgeleri ve yazılım sürüm kayıtları [CC BY-NC 4.0](LICENSE) koşullarına tabidir. Ticari kullanım için hak sahiplerinden yazılı izin gerekir. Harita, raster, font, kütüphane ve diğer üçüncü taraf kaynaklar bu lisansla yeniden lisanslanmaz; kendi lisansları ve hizmet koşulları geçerlidir.

Saha kullanıcılarının eklediği ölçüm, fotoğraf, konum ve kişisel veriler bu lisans bildirimiyle kendiliğinden yayımlanmış veya açık lisanslı hâle gelmez. Bu verilerin yayımlanması için hak, izin, rıza ve gizlilik koşulları ayrıca değerlendirilir. Üçüncü taraf yazılım, veri ve hizmetlerin sürüm/kaynak/lisans dökümü: [Üçüncü Taraf Lisans Envanteri](docs/THIRD_PARTY_LICENSES.md). Temel repo notları: [LICENSE](LICENSE) ve [NOTICE](NOTICE).

Başlıca veri atıfları OpenStreetMap (ODbL), ESA WorldCover 2021 v200 (CC BY 4.0), Impact Observatory Maps for Good Annual LULC 2020 (CC BY 4.0) ve kullanımına bağlı Copernicus Sentinel-2 verisidir. OpenTopoMap ve Esri World Imagery için katmana özgü sağlayıcı atıfları gerekir; harita ve dışa aktarımlarda kullanılacak tam metinler envanterde açıklanmıştır.

README başlığındaki Zenodo DOI, **DendroGeo v3.0.0 yazılım sürüm kaydına** aittir. Bir park raporunun DOI'si ancak o rapor için ayrıca atanmış ve yayımlanmışsa kullanılır; yazılım DOI'si rapor veya saha verisi DOI'si değildir. Sürüm ve yazılım atıf bilgisi [CITATION.cff](CITATION.cff) dosyasındadır.

## Güvenlik ve katkı

Güvenlik açığını herkese açık issue yerine [SECURITY.md](SECURITY.md) adresindeki özel bildirim yoluyla iletin. Hata ve geliştirme önerileri için [GitHub Issues](https://github.com/snansrin/dendrogeo/issues) kullanın.

Yüzey analiz motoru ve canlı harita DendroGeo'nun ana çekirdeğidir. Bu akışlarda değişiklikler [çekirdek kırmızı çizgilerine](docs/CORE-KIRMIZI-CIZGILER.md) göre izole edilmeli; bilimsel veya harita regresyonları ilgili testler, çoklu park kontrolleri, mobil görünüm ve CI ile doğrulanmalıdır.
