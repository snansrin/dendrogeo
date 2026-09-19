# DendroGeo — Sentinel-2 / 10 m LULC Methodology

## Data source

The application uses the ArcGIS ImageServer endpoint:

`Sentinel2_10m_LandCover/ImageServer`

The current service is a global Sentinel-2 10 m land-cover time series produced by Impact Observatory, Microsoft and Esri. The service exposes a single U8 categorical band, supports the Year field, and currently reports ~10 m pixel size and annual coverage through 2025.

Analysis is explicitly locked to **Year = 2020**.

## Current 9-class taxonomy

| Raster code | Class |
|---:|---|
| 1 | Water |
| 2 | Trees |
| 4 | Flooded Vegetation |
| 5 | Crops |
| 7 | Built Area |
| 8 | Bare Ground |
| 9 | Snow/Ice |
| 10 | Clouds |
| 11 | Rangeland |

Raster values 3 (old Grass) and 6 (old Scrub) are legacy values from the older release. When they appear in a response they are normalized to current class 11 Rangeland.

## Numerical method

The primary numerical result uses ArcGIS ImageServer `getSamples` with a deterministic **10 m multipoint lattice** generated inside the selected park polygon. The lattice is aligned to the published service grid origin and pixel size (EPSG:3857), rather than an arbitrary local 10 m grid.

For each lattice point:

- the point is sent directly as part of a multipoint request;
- `pixelSize=10,10` is requested;
- `RSP_NearestNeighbor` is requested;
- the mosaic is explicitly locked to **Year = 2020**.

ArcGIS documents that multipoint geometries use the supplied points directly, so the returned class values form a reproducible sampling frame. See https://developers.arcgis.com/rest/services-reference/enterprise/get-samples/.

The four user-facing classes are:

- **Yeşil alan** = Trees (2) + Flooded Vegetation (4) + Crops (5) + Rangeland (11)
- **Su** = Water (1)
- **Sert zemin** = Built Area (7)
- **Çıplak zemin** = Bare Ground (8)

The raw 10 m sample frequencies are converted to class shares and applied to the measured park polygon area:

`class_area = park_area × class_sample_count / valid_four_class_sample_count`

This is intentional: a pixel whose center is inside an irregular park boundary must not contribute a full 100 m² when part of that pixel lies outside the park. The final four class areas therefore conserve the park polygon area exactly (apart from floating-point rounding, which is explicitly closed in the largest class). NoData, unknown codes, snow/ice or clouds are not silently redistributed; if they occur, the four-class report is rejected rather than presenting a false closed total.

This is a reproducible 10 m nearest-neighbor, sample-frequency-derived park-area estimate. It is not presented as a sub-pixel boundary census; the area-conserving normalization prevents boundary pixels from inflating the park total.

## Independent QC

The application also calls ArcGIS `computeStatisticsHistograms` for the same park geometry and 2020 mosaic. ArcGIS documents that this operation requests source pixels at the specified resolution for the projected geometry's extent; therefore its returned histogram count is not used as DendroGeo's primary park-pixel denominator. See https://developers.arcgis.com/javascript/latest/references/core/layers/ImageryLayer/.

The histogram is retained as an independent distribution QC. DendroGeo compares normalized class distributions and reports a QC warning when the largest class-share difference exceeds the configured threshold. QC never overwrites the primary result.

## Outputs

The UI exports one compact four-class CSV containing sample counts, hectares, percentages, year and resolution. Detailed raster codes remain internal to the calculation engine.

## Interpretation

The product is a classified land-cover dataset, not raw Sentinel-2 spectral imagery and not an object/footprint inventory.

Class 7 Built Area represents the dataset's built-land-cover class. It must not be interpreted as an exact building-footprint polygon.

The published dataset has a global assessed average accuracy above 75%; this is a dataset-level assessment and is not a site-specific accuracy guarantee.

## Reproducibility

Every exported record contains the dataset name, year, source URL, resolution, and calculation method. The UI keeps the OSM water/impervious layers as independent structural QC; they do not silently replace satellite classes.


## 2020 ImageServer raster seçimi

Sentinel-2 2020 sorgusunda ImageServer raster kataloğundaki yalnızca **Category=1 (Primary)** öğeleri kullanılır. Overview ve diğer katalog kategorileri analize dahil edilmez. Seçili parkla kesişen Primary raster OBJECTID'leri katalog sorgusuyla bulunur ve analiz ile harita görselleştirmesinde aynı raster ID'leri LockRaster ile kullanılır. Böylece analiz ve harita farklı mozaik öğelerinden üretilemez.

Analizden önce ayrıca aynı kilitli 2020 mozaik üzerinde ImageServer histogramı bağımsız QC olarak alınır. GetSamples ile histogram arasında sınıfın var/yok durumu çelişirse sonuç raporlanmaz; eksik veya çelişkili veri sessizce başka sınıfa dağıtılmaz.
