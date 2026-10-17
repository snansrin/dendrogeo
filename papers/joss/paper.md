---
title: "DendroGeo: An integrated Web GIS for tree inventories, urban park surface analysis, and reproducible carbon assessment"
tags:
  - JavaScript
  - landscape architecture
  - urban parks
  - geographic information systems
  - tree inventory
  - remote sensing
  - carbon assessment
authors:
  - name: "Nagihan Şirin"
    orcid: "0009-0003-7372-0973"
    affiliation: 1
  - name: "Sinan Şirin"
    orcid: "0009-0009-6303-5140"
    affiliation: 2
    corresponding: true
affiliations:
  - name: "Department of Landscape Architecture, Faculty of Agriculture, Ankara University, Türkiye"
    index: 1
  - name: "Independent software development for DendroGeo, Türkiye"
    index: 2
date: 17 October 2026
bibliography: references.bib
---

# Summary

DendroGeo is an open-source Web Geographic Information System (Web GIS) that integrates georeferenced tree inventories, urban park surface analysis, vegetation-index interpretation, and model-based carbon assessment. Developed in the context of doctoral research in landscape architecture, it connects field measurements with the spatial composition of a park and preserves the evidence underlying a published analysis. Researchers can identify a mapped park, delineate a study area, examine land-cover and satellite observations, correct surface geometries, and publish an identifiable research report within the same browser environment.

The system provides complementary representations of individual trees and park surfaces. Tree records contain field measurements and derived estimates; park records contain boundaries, categorical land-cover evidence, and accepted spatial corrections. A park-relative Normalized Difference Vegetation Index (NDVI) layer supports interpretation of variation within its vegetated surfaces. Mobile field entry, offline record storage, shared projects, interactive map editing, and machine-readable exports connect data acquisition with subsequent analysis and reporting.

# Statement of need

Research on the carbon-storage performance and spatial characteristics of urban parks requires coordinated field and geospatial workflows. Landscape architecture researchers must relate tree measurements to study boundaries, distinguish vegetation from buildings, paved surfaces, water, and bare ground, examine satellite evidence, and document how corrections affect an analysis. When measurements, imagery, edited polygons, and calculations are maintained in separate files, identifying the precise evidence supporting a reported result becomes difficult.

DendroGeo addresses this coordination problem through a common project and park context. A location-based search retrieves candidate OpenStreetMap park polygons, including interior rings, while manual delineation supports areas requiring a different study boundary. Surface analysis intersects categorical raster cells with the selected boundary and presents source evidence alongside editable geometries. Researchers can review a cell, apply a brush correction, select a mapped object, or draw a polygon, rectangle, or circle. Accepted corrections are retained separately from the baseline classification and can be incorporated into a frozen publication snapshot.

The intended applications include landscape architecture research, park assessment, collaborative field surveys, and teaching. The system maintains an explicit distinction between the trees actually measured and the complete park area. This permits joint interpretation of inventory estimates and surface composition without treating a partial tree inventory as a park-wide census.

# State of the field

QGIS offers general-purpose spatial processing, cartography, and extensive vector-editing capabilities, including snapping and shape digitization [@qgis2026; @qgisEditing2026]. i-Tree Eco supports urban-forest assessment and ecosystem-service evaluation [@itreeeco2026]. Copernicus services provide access to Sentinel-2 imagery and spectral-index processing [@copernicus2026]. These tools establish important capabilities for the research domain.

DendroGeo's contribution is a park-oriented workflow combining automatic retrieval of available mapped boundaries, constrained surface editing, mobile tree measurement, spectral evidence, and versioned research publication. Users initiate park identification and analysis from the map without first assembling a desktop GIS project. This integration motivated a dedicated application: its observation identifiers, review decisions, access controls, and report snapshots must remain coordinated throughout collection and publication. CSV and GeoJSON exports maintain interoperability with desktop GIS and statistical environments.

The park-relative NDVI representation adds a specific interpretive function to this workflow. It summarizes repeated spectral observations and compares eligible vegetated cells within the selected park, rather than applying the same display breaks to every park. The contribution is the integration and explicit interpretation of these operations; comparative accuracy or execution-time advantages over other software require a common benchmark and are not inferred from interface responsiveness.

# Software design

## Park delineation and surface analysis

The park workflow separates boundary acquisition from surface classification. Location-based candidate retrieval and geocoding fallbacks use actual polygon geometries; a search bounding box is not substituted for the study boundary. Boundary containment and ring checks support selection of an appropriate candidate. This provides a direct route from a map location to a spatially defined analysis while retaining manual delineation where mapped data are unavailable or unsuitable.

ESA WorldCover 2021 v200 supplies a 10 m categorical baseline [@worldcover2021]. Surface areas are derived from raster-cell intersections with the park geometry. OpenStreetMap contributes separately attributed building, road, and water context [@osm2026]. The review workflow resolves five surface classes: vegetation, hard surfaces, buildings, water, and bare ground. Water features are represented under the common water class. Source rasters, provisional corrections, and accepted geometries remain distinguishable.

The editing tools support cell-level reclassification and geometry-based refinement. Drawn surface geometries are projected and clipped to the park boundary before application; rectangles and circles are constructed in projected coordinates rather than screen pixels. Object selection reuses available mapped geometries. This combination allows researchers to address narrow paved features, building footprints, and other locally important surfaces while preserving the original evidence. External-service availability is handled separately from analytical interpretation: missing vector evidence must not be interpreted as an absence of buildings, roads, or water.

## Spectral evidence and park-relative NDVI

The Sentinel-2 workflow collects valid observations using scene-classification masks, band-validity checks, and reflectance scale and offset metadata. It computes NDVI from the near-infrared and red bands and also records modified normalized difference water and normalized difference built-up indices as complementary spectral evidence [@copernicus2026]. Observation dates, scene identifiers, and evidence counts are retained with the profile. Repeated-date observations are not counted as independent temporal evidence.

For park-relative vegetation interpretation, the implementation uses the median NDVI over the selected temporal evidence for each eligible cell. Only cells currently classified as vegetation with at least three distinct valid observation dates are considered. With at least nine eligible cells, the one-third and two-thirds quantiles define three relative display tiers. These tiers describe the distribution of spectral greenness within that park and observation period. They do not alter categorical classes or area totals and are not calibrated measurements of canopy density, species composition, or physiological condition. Keeping this interpretation separate from accepted surface decisions allows spectral review without silently rewriting the study's classified geometry.

## Tree measurements, architecture, and publication

Field entry records stem circumference at 1.30 m above ground, tree height, location, and a species or group label. Diameter is derived as circumference divided by pi, retaining full precision for allometric calculations. Biomass and carbon outputs use documented model settings, including the implemented Chave relationship [@chave2014]. Their applicability depends on the measurement protocol, wood-density assumptions, and model domain; the outputs remain estimates rather than additional field observations.

Domain modules implement numerical and geometric rules; application modules coordinate use cases; adapters manage browser storage and external services; presentation modules render the interface. Dependency injection permits isolated tests of calculations and state transitions. This architecture protects research continuity when interaction or service code changes. Offline storage supports interrupted field connectivity, while explicit synchronization states distinguish local records from server-accepted records.

Publication freezes measurements, method settings, source descriptions, review geometry, and software provenance into a DendroGeo report (DGR). PDF, JSON, CSV, GeoJSON, and map artifacts are accompanied by a SHA-256 manifest. DGR identifiers and registered report DOIs support citation and revision tracking. The accompanying R and Python clients retrieve public artifacts and verify their hashes. Automated regression checks cover geometry, measurement transformations, review states, and report generation; browser checks address mobile interaction and accessibility. File integrity and software regression checks complement, but do not replace, field validation.

# Research impact statement

DendroGeo is used in ongoing doctoral research in landscape architecture on the carbon-storage performance of urban parks. The publicly accessible Göksu Park report DGR-2026-0026 provides a concrete research artifact with DOI 10.5281/zenodo.23404310 [@sirinGoksu2026]. Its frozen package contains 36 tree records dated 28 September to 1 October 2026, an analysis snapshot, a measurement table, tree-point and reviewed-surface geometries, a map, and report documents. Fieldwork is continuing; the package represents a dated research snapshot.

A reproducible audit verifies all eight manifest-listed artifacts and checks agreement between observation identifiers and counts in the JSON and CSV. The preserved source records application version 3.0.0 and land-cover engine version 4.3.0. These materials enable independent inspection of the connection between recorded observations, spatial decisions, and reported outputs. Earlier revisions sharing the same measurement table are not treated as additional surveys. No external adoption or peer-reviewed publication is claimed; the available evidence establishes an operational research workflow and reusable materials for subsequent evaluation.

# AI usage disclosure

Generative AI assisted software development, refactoring, tests, documentation, and manuscript preparation. OpenAI Codex using GPT-6 assisted this revision through source inspection and editorial drafting. Software behavior is checked through automated tests, browser checks, and artifact-integrity audits; manuscript claims were checked against implementation and cited sources. Human authors remain responsible for methodological interpretation, references, authorship, and final approval.

# Acknowledgements

The authors received no external funding; development was supported through their own resources. We acknowledge the providers and contributors of the open-source software and attributed spatial data used by DendroGeo. Sinan Şirin is the platform developer and corresponding author (sinan@dendrogeo.org). The authors report no sponsorship, patents, commercial income, paid consultancy, or other influencing relationships.

# References
