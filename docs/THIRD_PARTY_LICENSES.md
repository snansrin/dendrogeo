# Üçüncü taraf lisans envanteri

**Kapsam tarihi:** 4 Ekim 2026  
**Denetlenen sürüm:** `079deb264accd4daefe623beb132956a7347b8be`  
**Kaynaklar:** uygulamada yüklenen `vendor/` dosyaları, `package.json`, `package-lock.json`, harita katmanları ve arazi örtüsü veri kaynakları.

Bu envanter, repoda veya çalışan sitede kullanılan üçüncü taraf yazılımı, veri kümelerini ve hizmetleri listeler. DendroGeo bu lisansları satın almış veya üçüncü taraf içeriğin sahibi olmuş değildir. Kullanım, her hak sahibinin lisansı ve hizmet koşullarıyla sınırlıdır. Bir kaynağın lisansını DendroGeo lisansı altında yeniden yayımlamayın.

## DendroGeo içeriğinin kapsamı

DendroGeo'nun hak sahiplerinin yayımlama yetkisine sahip olduğu özgün kodu, arayüzü, belgeleri ve sürümlenmiş yazılım yayını, kök dizindeki [LICENSE](../LICENSE) uyarınca CC BY-NC 4.0 koşullarına tabidir. Bu bildirim:

- üçüncü taraf yazılımı, harita karolarını, raster verisini veya uzaktan sunulan hizmetleri yeniden lisanslamaz;
- saha kullanıcılarının yüklediği ölçüm, fotoğraf, konum veya kişisel veriye kendiliğinden açık lisans vermez;
- bir parka, araştırmaya, katılımcıya ya da ölçüm kaydına ilişkin yayın izni oluşturmaz.

Kullanıcı kaynaklı verinin yayımlanması için ilgili hak, izin, aydınlatma ve onaylar ayrıca değerlendirilmelidir. DendroGeo raporlarının her biri kendi veri kaynağını, kapsamını, atıflarını ve varsa yayın/DOI kaydını belirtir.

## Siteye dağıtılan yazılım

| Bileşen | Sürüm | Repodaki kullanım | Lisans | Kaynak / lisans kaydı |
|---|---:|---|---|---|
| Leaflet | 1.9.4 | `vendor/leaflet-1.9.4.js`, CSS ve `vendor/images/` | BSD-2-Clause | [Upstream](https://github.com/Leaflet/Leaflet/tree/v1.9.4) |
| Leaflet.markercluster | 1.5.3 | `vendor/leaflet.markercluster-1.5.3.js`, MarkerCluster CSS dosyaları | MIT | [Upstream](https://github.com/Leaflet/Leaflet.markercluster/tree/v1.5.3) |
| Supabase JavaScript client | 2.116.0 | `vendor/supabase-js-2.116.0.js` | MIT | [Upstream](https://github.com/supabase/supabase-js/tree/v2.116.0) |
| Chart.js | 4.5.1 | `vendor/chart.js-4.5.1.js` | MIT | [Upstream](https://github.com/chartjs/Chart.js/tree/v4.5.1) |
| GeoTIFF.js | 2.1.3 | `vendor/geotiff-2.1.3.js` | MIT | [Upstream](https://github.com/geotiffjs/geotiff.js/tree/v2.1.3) |
| polygon-clipping | 0.15.7 | `vendor/polygon-clipping-0.15.7.js` | MIT; bundle içinde ayrıca lisans başlıkları bulunur | [Repodaki MIT metni](../vendor/polygon-clipping-LICENSE.md) · [upstream](https://github.com/mfogel/polygon-clipping/tree/v0.15.7) |

Leaflet'in BSD koşulları, paketlerin MIT lisans bildirimleri ve polygon-clipping bundle'ındaki gömülü üçüncü taraf bildirimleri dağıtılan dosyalarda korunmalıdır. polygon-clipping bundle'ı splaytree 3.1.2 için MIT bildirimi ve Microsoft kaynaklı TypeScript yardımcı kodu için Apache-2.0 bildirimi içerir. Bağımlılıkların sürümleri ve kaynak dosyaları ayrıca [vendor/VERSIONS.md](../vendor/VERSIONS.md) içinde izlenir.

## Derleme ve test bağımlılıkları

Aşağıdaki paketler `package-lock.json` içinde kilitlidir ve sitede istemci betiği olarak yayımlanmaz. Sürümler, incelenen kilit dosyasına aittir. Paketlerin kendi lisans bildirimleri için [package-lock.json](../package-lock.json) ile npm upstream kayıtlarını esas alın.

| SPDX lisansı | Kilitli paketler |
|---|---|
| MIT | `ansi-regex@5.0.1`, `ansi-styles@4.3.0`, `camelcase@5.3.1`, `color-convert@2.0.1`, `color-name@1.1.4`, `decamelize@5.3.1`, `dijkstrajs@1.0.3`, `emoji-regex@8.0.0`, `find-up@4.1.0`, `is-fullwidth-code-point@3.0.0`, `locate-path@5.0.0`, `p-limit@2.3.0`, `p-locate@4.1.0`, `p-try@2.2.0`, `path-exists@4.0.0`, `pngjs@5.0.0`, `polygon-clipping@0.15.7`, `qrcode@1.5.4`, `require-directory@2.1.1`, `splaytree@3.2.3`, `string-width@4.2.3`, `strip-ansi@6.0.1`, `wrap-ansi@6.2.0`, `yargs@15.4.1` |
| ISC | `cliui@6.0.0`, `get-caller-file@2.0.0`, `require-main-filename@2.0.0`, `set-blocking@2.0.0`, `which-module@2.0.1`, `y18n@4.0.3`, `yargs-parser@18.1.3` |
| Apache-2.0 | `playwright-core@1.62.1` |
| Unlicense | `robust-predicates@3.0.3` |

`qrcode@1.5.4`, QR rapor çıktısını üreten derleme aracıdır; QR kodu kütüphanesinin tarayıcıya yüklenmesi gerekmez. `playwright-core` test otomasyonunda kullanılır. Lisans alanı SPDX özetidir; dağıtım veya kaynak güncellemesinde paketin içindeki lisans ve telif bildirimleri de korunmalıdır.

## Web fontları

Site, font dosyalarını depoya kopyalamak yerine Google Fonts CSS API'sini kullanır. Kullanılan aileler Fraunces, Manrope ve IBM Plex Mono'dur. Google Fonts kataloğundaki bu aileler SIL Open Font License 1.1 kapsamındadır. Font API'si uzaktan sunulduğundan dönen dosyaların sürümü repoda sabitlenmiş değildir.

- [Fraunces lisans kaynağı](https://github.com/google/fonts/tree/main/ofl/fraunces)
- [Manrope lisans kaynağı](https://github.com/google/fonts/tree/main/ofl/manrope)
- [IBM Plex Mono lisans kaynağı](https://github.com/google/fonts/tree/main/ofl/ibmplexmono)
- [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/)

## Harita, raster ve uzaktan sağlanan veri

| Kaynak | Sitedeki kullanım | Lisans / hizmet şartı | Atıf ve sınırlar |
|---|---|---|---|
| OpenStreetMap | Park geometrisi, yollar ve varsayılan harita karoları | Veri tabanı ODbL 1.0; karo sunucusunun kullanım politikası ayrıca geçerlidir | Haritada ve çıktıda `© OpenStreetMap contributors` görünür olmalıdır. Türetilmiş/veri tabanı kullanımı için ODbL'nin atıf ve paylaşım koşullarını inceleyin. [ODbL](https://opendatacommons.org/licenses/odbl/) · [OSM telif ve atıf](https://www.openstreetmap.org/copyright) |
| OpenTopoMap | İsteğe bağlı topoğrafik karo katmanı | CC BY-SA 3.0 | `© OpenTopoMap` ve harita verisi atfı korunmalı; türetilmiş harita içeriğinin paylaşım koşulları lisansla uyumlu olmalıdır. [Kullanım ve atıf](https://opentopomap.org/about) |
| Esri World Imagery | İsteğe bağlı uydu görüntüsü karo katmanı | Esri ArcGIS hizmet koşulları; katman içeriği için tek bir CC lisansı ileri sürülmez | Görüntü görünürken Esri ve veri sağlayıcılarının atfı gösterilmelidir. Atıf, hizmetin döndürdüğü kaynak zincirine göre değişebilir. Karolar depoda yeniden dağıtılmaz. [Esri lisanslama ve atıf](https://developers.arcgis.com/documentation/core-concepts/licensing-and-deployment/) |
| ESA WorldCover 2021 v200, 10 m | Birincil arazi örtüsü rasterı | CC BY 4.0 | Yayımlanmış harita/çıktıda şu sağlayıcı atfı korunmalıdır: `© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium`. Veri kümesi DOI'si: [10.5281/zenodo.7254221](https://doi.org/10.5281/zenodo.7254221). [ESA lisans, atıf ve alıntı](https://esa-worldcover.org/en/data-access) |
| Impact Observatory Maps for Good Annual LULC 2020 | Çapraz kontrol rasterı | CC BY 4.0; bu kayıt, IO Monitor özel sipariş/abonelik ürünleri için geçerli değildir | Veri kaynağını `Impact Observatory Maps for Good Annual LULC 2020` olarak belirtin ve [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) bağlantısını koruyun. [Ürün lisansı](https://docs.impactobservatory.com/lulc-maps/maps-for-good.html) |
| Copernicus Sentinel-2 L2A | Kullanıcı seçerse spektral çapraz kanıt; Microsoft Planetary Computer STAC/COG erişimi üzerinden | Copernicus'un serbest, tam ve açık veri politikası; AB Tüzüğü 2021/696 Madde 53. Bu kaynak CC BY 4.0 olarak tanımlanmamalıdır. Planetary Computer erişim koşulları da geçerlidir. | Veri kamuya iletilir veya dağıtılırsa kaynak bildirimi kullanın; değiştirilmiş veriye ilişkin metin: `Contains modified Copernicus Sentinel data [Year]`. [Copernicus Sentinel-2](https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2) · [Yasal bildirim](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice) · [AB Tüzüğü 2021/696](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=oj%3AJOL_2021_170_R) · [Microsoft Planetary Computer veri sayfası](https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a) |

OpenStreetMap, OpenTopoMap, Esri, ESA, Impact Observatory ve Copernicus katmanlarının atıfları birbirinin yerine geçmez. Kullanılan katmana uygun metin görünür harita, dışa aktarılan görüntü ve yayımlanmış analiz raporunda korunmalıdır. API/karoların erişilebilir olması, hizmet şartlarından bağımsız ve sınırsız kullanım izni anlamına gelmez.

## DOI ve sürüm ayrımı

README'deki `10.5281/zenodo.22948643` DOI'si DendroGeo yazılım sürümüne aittir. ESA WorldCover'un `10.5281/zenodo.7254221` DOI'si ESA veri kümesine aittir. Bir DendroGeo park raporu veya kullanıcı veri yayını, yalnızca kendisi için ayrı bir yayın kaydı ve DOI oluşturulduğunda bu DOI ile atıf alır.

## Gözden geçirme

Yeni bir dağıtılan kütüphane, font ailesi, karo sağlayıcısı veya veri kümesi eklendiğinde bu envanteri ve gerekli atıfları güncelleyin. Her sürüm yükseltmesinde lisans türünü, upstream lisans metnini, dosya/sürüm bağını ve harita çıktısındaki atfı yeniden doğrulayın. DendroGeo lisansının kapsamı veya yayımlama izni belirsizse içeriği yayımlamayın; yetkili hak sahibinden açıklık alın.
