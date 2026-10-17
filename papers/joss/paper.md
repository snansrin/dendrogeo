---
title: "DendroGeo: An integrated Web GIS for urban park delineation, surface analysis, and relative NDVI assessment"
tags:
  - JavaScript
  - landscape architecture
  - urban parks
  - geographic information systems
  - remote sensing
  - land cover
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

DendroGeo is an open-source Web Geographic Information System (Web GIS) for identifying urban park boundaries, analysing surface composition, editing spatial evidence, and interpreting park-relative vegetation-index patterns. Developed in the context of doctoral research in landscape architecture, it brings study-area definition, land-cover assessment, satellite evidence, and research reporting into a common browser environment. Researchers can select a mapped park or delineate a study area, inspect its surface classes, refine the analysis using interactive geometry tools, and preserve the resulting decisions in an identifiable report.

The analytical workflow combines a categorical land-cover baseline with separately attributed vector context and Sentinel-2 spectral observations. User corrections are reviewed and accepted without overwriting the source raster. A park-relative Normalized Difference Vegetation Index (NDVI) layer describes variation among eligible vegetated cells within the study area. Shared projects, map interaction, and machine-readable exports support collaborative review and reuse of the accepted spatial outputs.

# Statement of need

Research on urban park composition and vegetation patterns requires coordinated geospatial workflows. Landscape architecture researchers must establish defensible study boundaries, distinguish vegetation from buildings, paved surfaces, water, and bare ground, interpret satellite evidence, and document how manual refinements affect the analysis. When imagery, classifications, edited polygons, and area calculations are maintained in separate files, reconstructing the exact evidence supporting a reported result becomes difficult.

DendroGeo addresses this coordination problem through a common project and park context. A location-based search retrieves candidate OpenStreetMap park polygons, including interior rings, while manual delineation supports areas requiring a different study boundary. Surface analysis intersects categorical raster cells with the selected boundary and presents source evidence alongside editable geometries. Researchers can review a cell, apply a brush correction, select a mapped object, or draw a polygon, rectangle, or circle. Accepted corrections are retained separately from the baseline classification and can be incorporated into a frozen publication snapshot.

The intended applications include landscape architecture research, urban park assessment, collaborative spatial review, and teaching. The study boundary defines the analytical extent, while source data, spectral interpretation, and accepted surface decisions retain their distinct roles. This structure allows researchers to inspect both the resulting area statistics and the decisions responsible for them.

# State of the field

QGIS offers general-purpose spatial processing, cartography, and extensive vector-editing capabilities, including snapping and shape digitization [@qgis2026; @qgisEditing2026]. Copernicus services provide access to Sentinel-2 imagery and spectral-index processing [@copernicus2026]. These tools establish important capabilities for the research domain.

DendroGeo's contribution is a park-oriented workflow combining automatic retrieval of available mapped boundaries, constrained surface editing, park-relative spectral interpretation, and versioned research publication. Users initiate park identification and analysis from the map without first assembling a desktop GIS project. This integration motivated a dedicated application: its park identifiers, review decisions, access controls, and report snapshots must remain coordinated throughout collection and publication. CSV and GeoJSON exports maintain interoperability with desktop GIS and statistical environments.

The park-relative NDVI representation adds a specific interpretive function to this workflow. It summarizes repeated spectral observations and compares eligible vegetated cells within the selected park, rather than applying the same display breaks to every park. The contribution is the integration and explicit interpretation of these operations; comparative accuracy or execution-time advantages over other software require a common benchmark and are not inferred from interface responsiveness.

# Software design

## Park delineation and surface analysis

The park workflow separates boundary acquisition from surface classification. Location-based candidate retrieval and geocoding fallbacks use actual polygon geometries; a search bounding box is not substituted for the study boundary. Boundary containment and ring checks support selection of an appropriate candidate. This provides a direct route from a map location to a spatially defined analysis while retaining manual delineation where mapped data are unavailable or unsuitable.

ESA WorldCover 2021 v200 supplies a 10 m categorical baseline [@worldcover2021]. Surface areas are derived from raster-cell intersections with the park geometry. OpenStreetMap contributes separately attributed building, road, and water context [@osm2026]. The review workflow resolves five surface classes: vegetation, hard surfaces, buildings, water, and bare ground. Water features are represented under the common water class. Source rasters, provisional corrections, and accepted geometries remain distinguishable.

The editing tools support cell-level reclassification and geometry-based refinement. Drawn surface geometries are projected and clipped to the park boundary before application; rectangles and circles are constructed in projected coordinates rather than screen pixels. Object selection reuses available mapped geometries. This combination allows researchers to address narrow paved features, building footprints, and other locally important surfaces while preserving the original evidence. External-service availability is handled separately from analytical interpretation: missing vector evidence must not be interpreted as an absence of buildings, roads, or water.

## Spectral evidence and park-relative NDVI

The Sentinel-2 workflow collects valid observations using scene-classification masks, band-validity checks, and reflectance scale and offset metadata. It computes NDVI from the near-infrared and red bands and also records modified normalized difference water and normalized difference built-up indices as complementary spectral evidence [@copernicus2026]. Observation dates, scene identifiers, and evidence counts are retained with the profile. Repeated-date observations are not counted as independent temporal evidence.

For park-relative vegetation interpretation, the implementation uses the median NDVI over the selected temporal evidence for each eligible cell. Only cells currently classified as vegetation with at least three distinct valid observation dates are considered. With at least nine eligible cells, the one-third and two-thirds quantiles define three relative display tiers. These tiers describe the distribution of spectral greenness within that park and observation period. They do not alter categorical classes or area totals and are not calibrated measurements of canopy density, species composition, or physiological condition. Keeping this interpretation separate from accepted surface decisions allows spectral review without silently rewriting the study's classified geometry.

## Architecture and reproducible publication

Domain modules implement numerical and geometric rules; application modules coordinate use cases; adapters manage browser storage and external services; presentation modules render the interface. Dependency injection permits isolated tests of calculations and state transitions. This architecture protects research continuity when interaction or service code changes. The browser interface coordinates park selection, analysis progress, editing sessions, and acceptance states. Explicit separation of provisional and accepted results prevents a new display setting or an unfinished edit from being presented as the published geometry.

Publication freezes analysis settings, source descriptions, accepted surface geometry, and software provenance into a DendroGeo report (DGR). PDF, JSON, CSV, GeoJSON, and map artifacts are accompanied by a SHA-256 manifest. DGR identifiers and registered report DOIs support citation and revision tracking. The accompanying R and Python clients retrieve public artifacts and verify their hashes. Automated regression checks cover geometry, spectral summaries, review states, and report generation; browser checks address mobile interaction and accessibility. File integrity and software regression checks complement, but do not replace, independent spatial validation.

# Research impact statement

DendroGeo supports an ongoing doctoral research workflow in landscape architecture concerning urban parks. The publicly accessible Göksu Park report DGR-2026-0026 provides a concrete archived research artifact with DOI 10.5281/zenodo.23404310 [@sirinGoksu2026]. For this manuscript, its relevant outputs are the accepted five-class surface geometries, rendered park map, structured analysis snapshot, source descriptions, and report provenance. These materials make the spatial review and publication workflow inspectable through a real study area.

A reproducible audit verifies all eight manifest-listed artifacts in the historical package. Its surface GeoJSON contains five MultiPolygon features; the snapshot preserves accepted boundary and review information. The archived provenance records application version 3.0.0 and land-cover engine version 4.3.0, so the historical output remains distinguishable from the current implementation. The checksum audit establishes artifact identity, not classification accuracy. No external adoption or peer-reviewed publication is claimed; the available materials document an operational park-analysis workflow and provide a basis for reproducible evaluation. Current spectral-display behavior is documented against the implementation rather than attributed retrospectively to an older report without evidence.

# AI usage disclosure

Generative AI assisted software development, refactoring, tests, documentation, and manuscript preparation. OpenAI Codex using GPT-6 assisted this revision through source inspection and editorial drafting. Software behavior is checked through automated tests, browser checks, and artifact-integrity audits; manuscript claims were checked against implementation and cited sources. Human authors remain responsible for methodological interpretation, references, authorship, and final approval.

# Acknowledgements

The authors received no external funding; development was supported through their own resources. We acknowledge the providers and contributors of the open-source software and attributed spatial data used by DendroGeo. Sinan Şirin is the platform developer and corresponding author (sinan@dendrogeo.org). The authors report no sponsorship, patents, commercial income, paid consultancy, or other influencing relationships.

# References
