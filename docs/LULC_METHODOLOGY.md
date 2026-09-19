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

The primary numerical result uses ArcGIS ImageServer `getSamples` with a deterministic **10 m multipoint lattice** generated inside the selected park polygon.

For each lattice point:

- the point is sent directly as part of a multipoint request;
- `pixelSize=10,10` is requested;
- `RSP_NearestNeighbor` is requested;
- the mosaic is explicitly locked to **Year = 2020**.

ArcGIS documents that multipoint geometries use the supplied points directly, so the returned class values form a reproducible sampling frame. See https://developers.arcgis.com/rest/services-reference/enterprise/get-samples/.

For each class:

`class_area = park_area × valid_class_sample_count / requested_sample_count`

The measured park area remains the geometric reference area. Missing/NoData/unknown samples are retained as an explicitly unclassified remainder and are **not** redistributed among classes.

This is a reproducible 10 m nearest-neighbor sample-derived estimate. It is not presented as an exact census of every source raster cell or as sub-pixel boundary accuracy.

## Independent QC

The application also calls ArcGIS `computeStatisticsHistograms` for the same park geometry and 2020 mosaic. ArcGIS documents that this operation requests source pixels at the specified resolution for the projected geometry's extent; therefore its returned histogram count is not used as DendroGeo's primary park-pixel denominator. See https://developers.arcgis.com/javascript/latest/references/core/layers/ImageryLayer/.

The histogram is retained as an independent distribution QC. DendroGeo compares normalized class distributions and reports a QC warning when the largest class-share difference exceeds the configured threshold. QC never overwrites the primary result.

## Outputs

The UI can export:

- `dendrogeo_lulc_2020_classes.csv`: class-level raster counts, hectares and percentages plus provenance metadata.
- `dendrogeo_lulc_2020_qc_samples.geojson`: geolocated `getSamples` QC observations with raw and normalized class codes.

## Interpretation

The product is a classified land-cover dataset, not raw Sentinel-2 spectral imagery and not an object/footprint inventory.

Class 7 Built Area represents the dataset's built-land-cover class. It must not be interpreted as an exact building-footprint polygon.

The published dataset has a global assessed average accuracy above 75%; this is a dataset-level assessment and is not a site-specific accuracy guarantee.

## Reproducibility

Every exported record contains the dataset name, year, source URL, resolution, and calculation method. The UI keeps the OSM water/impervious layers as independent structural QC; they do not silently replace satellite classes.
