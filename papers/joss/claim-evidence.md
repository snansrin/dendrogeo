# JOSS manuscript claim-to-implementation review

Reviewed 17 October 2026. This note supports manuscript editing; it is not an independent field-validation study or performance benchmark.

| Manuscript statement | Repository evidence | Interpretation limit |
| --- | --- | --- |
| Location-based park candidate selection | src/application/parks/detect-park.js; src/services/park-query.js | Retrieves existing mapped polygons; does not infer legal boundaries from imagery. |
| Actual polygon fallback, holes and containment checks | src/application/parks/find-nominatim-boundary.js | Search bounding boxes are not substituted for park geometry. |
| Five-class surface workflow and user corrections | docs/CORE-KIRMIZI-CIZGILER.md; src/domain/surface/classify-surface-vegetation-tiers.js | Preserve baseline, edits and accepted state; water remains one class. |
| Projected rectangle and circle construction | src/domain/surface/build-boundary-shape-ring.js | Circle is a 96-vertex polygon; no claim of analytic circular geometry. |
| Surface drawings clipped to study boundary | src/domain/surface/prepare-surface-boundary.js | Validates, projects and intersects; does not establish survey accuracy. |
| SCL masks, band checks, distinct dates and spectral indices | src/application/surface/collect-sentinel-scene-observations.js | Spectral evidence is neither botanical identification nor independent accuracy validation. |
| Reflectance offset handling and temporal summaries | src/domain/surface/sentinel-spectral-evidence.js; src/application/surface/build-sentinel-profile.js | Temporal composites depend on scene availability and valid observations. |
| Park-relative vegetation tiers | src/domain/surface/classify-surface-vegetation-tiers.js | Green cells only; at least three dates per cell and nine eligible cells; tercile cutoffs; no raster-class or area modification. |
| Layered architecture and dependency boundaries | docs/adr/0005-incremental-layered-architecture.md | Incremental layered classic-script architecture; do not describe an ES-module or bundler migration. |
| Published research example with 36 records and eight artifacts | papers/evidence/dgr-2026-0026-audit.json; papers/tools/audit_public_report.py | Fixed snapshot; ongoing fieldwork; integrity is not scientific validation. |

## Comparative claims

No controlled QGIS timing, boundary-accuracy or classification-accuracy comparison was available for this revision. The paper therefore explains the direct map-to-park workflow without claiming that it is universally faster or more accurate than QGIS. No measured seconds-per-park value is invented. A publishable comparison would require identical study areas and input data, explicit completion criteria, independent reference boundaries, repeated measurements, hardware/network descriptions and scripts with recorded results.

NDVI is a spectral index, whereas park-boundary retrieval and surface interpretation are different operations. Park-relative tiers are a distribution-based display of temporal NDVI evidence, not a validated replacement for NDVI or a new absolute vegetation-health metric. Tied quantiles can yield uneven tier sizes; the paper does not promise equal populations or cross-park comparability.

The corresponding-author designation, affiliations and declarations use author-supplied information. Final joint text approval and complete historical AI disclosure are submission gates recorded in README.md and ../SUBMISSION-STATUS.md.
