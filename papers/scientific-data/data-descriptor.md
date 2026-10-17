# Working draft: Data Descriptor

**Submission status:** internal working draft; not submitted. Author declarations, field-method clarification and final manuscript approval remain outstanding. Rights-holder permission for a separate primary-data release under CC BY 4.0 was supplied on 17 October 2026. A separate journal-ready dataset must be deposited under compatible terms before this proposed new release can be identified by a dataset DOI. Until then, this draft does not define a new released dataset and must not be cited as one. The existing report and its original licence remain separately identifiable.

## Title

Georeferenced tree measurements and derived estimates for Göksu Park in Ankara

## Authors

Nagihan Şirin¹ (ORCID 0009-0003-7372-0973; nagihan@dendrogeo.org), Sinan Şirin² (ORCID 0009-0009-6303-5140; sinan@dendrogeo.org)

¹ Department of Landscape Architecture, Faculty of Agriculture, Ankara University, Türkiye (doctoral student)  
² Independent software development for DendroGeo, Türkiye; unrelated employment is not represented as project affiliation  
Corresponding author: Sinan Şirin, sinan@dendrogeo.org. Both authors are included with reported agreement; final manuscript and detailed contributions require joint approval.

## Abstract

Urban-park inventories require explicit separation of observations, model outputs and spatial context. This Data Descriptor documents a fixed snapshot of 36 georeferenced tree records from Göksu Park in Ankara, Türkiye, dated 28 September to 1 October 2026. A primary-observation table preserves stem circumference, height, recorded tree labels and location metadata; a separate joined table preserves derived diameter, carbon and volume estimates. A field dictionary, provenance metadata and SHA-256 manifest document transformations from the frozen DendroGeo report DGR-2026-0026. Fieldwork is ongoing. The documentation identifies missing positional-accuracy values and limitations of sampling and allometric assumptions. Reviewed surface geometries remain separately licensed context in the source report and are excluded from the new primary-data package. These records support inspection and reuse of the documented observations; they do not establish a complete park census, independently validated spatial accuracy or locally calibrated carbon estimates.

## Background & Summary

Urban tree data are more reusable when observations, transformations, geographic context and revision history can be reconstructed together. A table of derived biomass values is difficult to interpret without its stem-measurement convention, units, model parameters and sampling context. Spatial layers also need a documented distinction between externally supplied classifications and human-reviewed surface decisions.

The collection described here is drawn from the frozen DendroGeo report DGR-2026-0026 for Göksu Park, Ankara [1]. Its purpose is to document an identifiable set of observations and linked spatial evidence, rather than to estimate the carbon stock of every tree in the park. The source report belongs to a doctoral research workflow concerning carbon-storage performance in urban parks. The dataset scope is one park and one recorded observation period. Fieldwork is ongoing; this release is a fixed 36-record snapshot, not a final park inventory.

The data package preserves both observation fields and derived fields. The archived snapshot records the software version, code revision, allometric settings, accepted surface geometry and source descriptions used to produce the report. General-purpose GIS software can read the GeoJSON files, and standard tabular tools can read the CSV. The associated R and Python clients retrieve public artifacts and verify their manifest hashes.

Reports DGR-2026-0024, DGR-2026-0025 and DGR-2026-0026 are successive revisions of this material. Their measurement CSV files have identical SHA-256 digests. They must not be combined as three independent surveys. The present description uses the latest of these three packages and preserves the earlier identities only as provenance.

## Methods

### Source selection and preservation

The source is the repository copy of DGR-2026-0026, generated on 15 October 2026. Its metadata records DOI 10.5281/zenodo.23404310. That identifier refers to the existing research report and associated artifacts; it is not represented here as a newly deposited dataset DOI. The source snapshot records application version 3.0.0, DendroGeo LC Engine version 4.3.0 and code revision 4c199515035e6bdc8dfb56b84687751ebc4332a5.

Manuscript preparation uses a read-only audit of the frozen package. No measurement, accepted geometry, published report, original licence or original manifest is rewritten. Eight artifacts are listed in the source manifest: the HTML report, PDF report, JSON snapshot, JSON metadata, measurement CSV, point GeoJSON, surface GeoJSON and rendered map. An editorial evidence file records each artifact's byte length and recomputed SHA-256 digest.

### Field observations and measurement convention

The source contains 36 records with timestamps spanning 28 September to 1 October 2026. Each JSON row stores a local record identifier, point identifier, recorded tree name, broadleaf/conifer group, stem circumference, derived diameter, height, geographic coordinates, optional location-accuracy value and derived quantities.

The documented software protocol specifies stem circumference C, in centimetres, at 1.30 m above ground. Diameter D is derived as D = C / pi and retained at full numerical precision in the JSON snapshot. The CSV displays diameter to one decimal place. CSV rounding therefore must not be used to reconstruct the full-precision source diameter.

Although structured sampling and instrument descriptors are empty, source report section 4.1 documents a measuring tape for circumference at 1.30 m, field-measured height recorded to 0.1 m and civilian GNSS coordinates. The height instrument model, calibration, tree-selection design and independent repeat measurements are not documented. These additional details require investigator clarification before submission. The observation count cannot establish that all park trees were measured or that a probability-sampling design was followed.

Tree names are preserved as recorded Turkish labels. A successful lookup in the project's density table is not botanical verification of an individual tree. Users requiring species-level inference should reconcile these labels against an appropriate taxonomic authority and verify uncertain identifications.

### Coordinates and positional uncertainty

The tabular latitude and longitude values are geographic coordinates in decimal degrees. GeoJSON coordinates use longitude followed by latitude. The archived accepted-boundary arrays in data.json at lulc.review.outer and lulc.review.holes instead use latitude followed by longitude; these nested arrays must be converted before direct use as GeoJSON coordinates.

EPSG:32636 identifies the projected analysis context, UTM zone 36N. It does not mean that the stored geographic coordinate pairs are easting/northing values. Applications must interpret each field according to its storage convention before projection.

A location-accuracy value is present for 23 rows and missing for 13. Missing accuracy is not zero error. The package does not identify the acquisition hardware or establish that all coordinates were obtained through the same process. Device-reported accuracy, when present, is retained as source metadata and is not an independently measured positional error.

### Derived diameter, biomass, carbon and volume

The implementation uses the Chave et al. pantropical allometric relationship [2]:

AGB = 0.0673 × (rho × D² × H)^0.976,

where AGB is aboveground biomass in kilograms, D is diameter in centimetres, H is height in metres and rho is wood density in grams per cubic centimetre. The project's lookup values are expressed in kilograms per cubic metre and divided by 1000 for this equation. The software applies BGB = 0.26 × AGB and carbon = 0.47 × (AGB + BGB). These multipliers are retained as assumptions of the archived processing chain.

The snapshot's QA metadata identifies seven species-table matches and 29 group-level density fallbacks. Group fallback values must not be described as individually measured wood density or species-specific estimates. The pantropical equation was not fitted to this Ankara collection. Its output is a model-dependent estimate whose applicability to these urban trees requires separate evaluation.

The JSON snapshot also stores volume estimates. The inspected implementation uses a cylindrical stem expression with a fixed form factor of 0.5: V = pi × (D/200)² × H × 0.5, in cubic metres. This is a modeled quantity rather than a measured timber volume.

### Uncertainty settings

The source records 1000 Monte Carlo realizations, random seed 20260926, circumference standard deviation 0.5 cm, height standard deviation 0.25 m, model coefficient of variation 0.22 and a nominal interval level of 0.95. The implementation perturbs circumference before deriving diameter, perturbs height, applies a common model multiplier for the total, and recentres simulated estimates on the stored point estimate.

These settings describe assumed input/model uncertainty in this processing chain. They do not demonstrate instrument calibration, account for allometric model transfer to Ankara, quantify taxonomic uncertainty or include the sampling uncertainty associated with unmeasured park trees. The reported interval must be interpreted conditionally on these assumptions.

### Reviewed surface evidence

The source surface workflow combines baseline ESA WorldCover 2021 v200 categorical evidence [3], OpenStreetMap context [4], Sentinel-2 scene evidence and accepted editing decisions. Five nonzero surface classes are represented in surface.geojson: green area, hard surface, building, water and bare ground. Historical zero-area pool and other entries remain in the snapshot vocabulary and do not define additional nonzero classes in the spatial file.

The snapshot records six Sentinel-2 L2A scene identifiers with dates 20 April, 1 July, 21 July, 8 August, 12 September and 9 October 2026. The accepted geometries are reviewed outputs. This package does not contain the full satellite-image products or a pixel-by-pixel record assigning every editing decision to a particular scene. The manuscript therefore does not claim that the classification can be independently reconstructed from those scene identifiers alone.

The source distinguishes accepted analysis geometry and display geometry. The historical report correction concerns map presentation; it does not create a second field survey. Baseline WorldCover reference year 2021, satellite acquisition dates in 2026 and report generation date in 2026 describe different events and must not be treated as one observation date.

## Data Records

The existing source report is identified by DOI 10.5281/zenodo.23404310 [1] and is accessible through the public report route https://dendrogeo.org/rapor/DGR-2026-0026/. Its declared licence is CC BY-NC 4.0. The proposed Scientific Data deposit has not yet been registered; its primary-table scope and CC BY 4.0 permission are documented in the local candidate, while authorship declarations and deposit remain pending. No replacement DOI is invented.

| File | Content and interpretation |
| --- | --- |
| manifest.json | Source report identifier, result-hash reference and eight artifact SHA-256 digests. |
| data.json | Full-precision tree rows, accepted boundary arrays, surface review, model settings, source provenance and internal QA. |
| metadata.json | Report title, author attribution, declared licence, DOI, code revision and revision relationships. |
| olcum.csv | 36 measurement rows with recorded names, circumference, rounded diameter, height, carbon estimates and coordinates. |
| park.geojson | Despite its historical name, this file contains 36 tree Point features; it is not a park-boundary Polygon file. |
| surface.geojson | Five reviewed surface MultiPolygon features with class, method and area properties. |
| harita.png | Rendered presentation of the spatial evidence; unsuitable as a substitute for the geometries. |
| index.html and rapor.pdf | Human-readable source report and its PDF representation. |

The accompanying data-dictionary.csv documents the measurement export's columns and units. papers/evidence/dgr-2026-0026-audit.json records the reproducible artifact checks. The source author attribution is retained; authorship of the proposed manuscript and of any separately deposited collection requires the authors' agreement.

## Technical Validation

The manuscript audit recomputed all eight manifest-listed file hashes and found them consistent with the source manifest. It checked that the report identifiers and result-hash references agree across the manifest and metadata, that the measurement JSON and CSV both contain 36 records, and that their point-identifier sets agree. No duplicate JSON row or point identifiers were found.

The audit checked positive finite circumference, diameter and height, finite nonnegative carbon estimates, geographic-coordinate ranges and the equality of full-precision JSON diameter to circumference divided by pi. It also parsed the GeoJSON feature collections and checked closed polygon rings and geographic-coordinate ranges. The point file contains 36 points; the surface file contains five features with 761 rings.

These are file-integrity and structural checks, not an external accuracy assessment. The archived report additionally records zero points outside its selected boundary, no polygon self-intersections and internal QA status GECERLI. These source-reported flags are preserved without treating them as independent ground truth. One height/diameter screening indication is present in the source QA; it is an inspection flag rather than a field remeasurement.

No independent field audit, survey-grade positional comparison, destructive biomass validation or reference-based surface confusion matrix is included in the package. Instrument and sampling information must be supplied by the investigators or explicitly retained as a dataset limitation. Technical validation of file structure does not resolve these scientific limitations.

## Usage Notes

Use the JSON rows for full-precision diameter and the CSV for interoperable tabular access. Preserve the distinction between local identifiers and biological identity; a point identifier alone does not establish longitudinal tracking across unrelated projects.

Use the surface GeoJSON for geometry and inspect the snapshot for accepted-boundary provenance. Do not infer sub-metre accuracy from finely drawn vectors or mistake the project EPSG code for the coordinate order of stored arrays. Reviewed decisions may improve usability but do not establish classification accuracy without an independent reference sample.

Do not interpret the recorded trees as a complete park census, extrapolate their carbon sum to unmeasured trees without an appropriate sampling design, or treat the Monte Carlo interval as including all sources of uncertainty. Revisions with identical measurement-file digests must not be counted as independent temporal replicates.

The existing CC BY-NC licence and source-specific third-party conditions continue to apply. The rights holder authorized a new CC BY 4.0 release of owned primary tables on 17 October 2026; this permission excludes third-party layers. OpenStreetMap-derived material and other source layers require separate attribution and review of their own licence obligations.

## Data Availability

The frozen source package is available through DGR-2026-0026 and its recorded report DOI [1]. A separately curated, journal-compatible dataset release remains pending. Prior to submission, the authors must confirm anonymous reviewer access to the complete data, the repository accession, the exact files included and their applicable licences. This paragraph must be updated with the actual deposit record once completed.

## Code Availability

DendroGeo source code is available at https://github.com/snansrin/dendrogeo under the MIT licence. The archived analysis identifies revision 4c199515035e6bdc8dfb56b84687751ebc4332a5. The software archive is separately identified by DOI 10.5281/zenodo.22948643 [5]; this software DOI is not a data accession.

The manuscript audit is papers/tools/audit_public_report.py and uses the Python standard library. Run it from the repository root with the source report directory and an output evidence path. It reads frozen files and writes only editorial evidence. It does not access user accounts, modify measurements or publish data. R/Python access clients are distributed under clients/.

## References

1. Şirin, N. Kent parklarının karbon depolama performansının saptanması Göksu Parkı örneği. DGR-2026-0026, Zenodo. https://doi.org/10.5281/zenodo.23404310 (2026). Source research report and associated artifacts.
2. Chave, J. et al. Improved allometric models to estimate the aboveground biomass of tropical trees. Global Change Biology 20, 3177–3190. https://doi.org/10.1111/gcb.12629 (2014).
3. Zanaga, D. et al. ESA WorldCover 10 m 2021 v200. Zenodo. https://doi.org/10.5281/zenodo.7254221 (2022).
4. OpenStreetMap contributors. OpenStreetMap copyright and licence. https://www.openstreetmap.org/copyright (accessed 17 October 2026).
5. Şirin, N. & Şirin, S. DendroGeo: Küresel Ağaç Envanteri ve Karbon Veri Sistemi, version 3.0.0. Zenodo. https://doi.org/10.5281/zenodo.22948643 (2026).

## Author Contributions

Sinan Şirin developed the DendroGeo platform. Nagihan Şirin conducts doctoral research in landscape architecture and has agreed to be an author of both proposed manuscripts. Detailed contributions and final text approval must still be agreed by both authors; no contribution statement is asserted solely from repository authorship or data visibility. Transfer the agreed statement into the submission system when required by its current format.

## Competing Interests

The authors declare no sponsorship, patents, commercial income, paid consultancy or other relationships reported as capable of influencing the work. Sinan Şirin is the developer of DendroGeo; this role is disclosed for transparency.

## Funding

The authors report no external funding. The system was established and developed using their own resources.

## AI assistance and author review

OpenAI Codex, using GPT-6 for this revision, assisted with manuscript structure, language, source inspection and development of the read-only artifact audit. The measurements and surface decisions were taken from the existing frozen report rather than generated by an AI model. Human authors must review the manuscript, verify the field protocol, approve declarations and confirm the complete scope of AI assistance before submission.

## Separately licensed primary-data deposit candidate

The author-review package in deposit-candidate contains tree-observations.csv and derived-estimates.csv joined by point_id, with a field dictionary, metadata, licence scope and SHA-256 manifest. Rights-holder authorization permits CC BY 4.0 for these newly scoped primary-data tables and documentation. Photographs, database row identifiers, OSM boundaries, reviewed surface geometries, imagery and original report artifacts are excluded. Spatial context discussed above refers to the separately licensed source report and is not included in the new CC BY release. The source report DOI is not a new dataset DOI. No new repository deposit has been registered. New metadata uses author-confirmed ORCID ownership without rewriting immutable source attribution.
