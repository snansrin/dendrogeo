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

The primary area calculation uses ArcGIS:

`computeStatisticsHistograms`

with the actual selected park polygon and the explicit 2020 mosaic rule.

For each class:

`class_area = park_area * class_pixel_count / histogram_pixel_count`

The denominator is the histogram raster-cell count returned by the image service, not the number of client-side sampling points.

Unmapped/NoData bins are retained and reported instead of being silently redistributed across land-cover classes.

## Independent QC

The application also calls ArcGIS `getSamples` using a deterministic 10 m sampling lattice inside the park polygon.

These are **sample points**, not the raster's zonal pixel count. Their class proportions are compared with the server-side histogram distribution. QC samples never overwrite the primary zonal result.

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
