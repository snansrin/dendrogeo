# Park analysis latency and boundary selection — 16 October 2026

## Scope and recovery

Baseline: `5eb014a0b3925ebb74f3386d01034737d5b027b7`; branch: `fix/park-analysis-latency-20261016`.

The reported console log contains upstream Overpass timeouts and 502/504 responses. A gateway response without CORS headers is exposed to browser JavaScript as a network failure; changing application CORS settings cannot repair that upstream response.

## Modular corrections

| Area | Finding | Correction |
|---|---|---|
| OSM recovery | A short park timeout did not tell detail loading to use independent recovery. | Record a temporary degraded hint without calling a short client timeout a server outage. Prefer the existing bounded native OSM recovery after degradation. |
| Mirror sequencing | Full detail queries exhausted multiple mirrors before native recovery; each split group received a new 75-second budget. | Try one mirror before native recovery, then use a single absolute 75-second deadline for the full/split workflow. Preserve complete-only cache and all tag families. |
| Repeated evidence loading | Analysis/refinement/editor mount could repeat a just-exhausted park recovery. | Record same-boundary failures for 30 seconds and avoid restarting that chain; explicit detailed retry remains available. Independent narrower requests remain possible when full recovery was not exhausted. |
| First analysis click | Controls stayed active throughout cold lazy loading; scripts downloaded sequentially. | Lock and show progress immediately; continue the original click through load and analysis. Preload an eight-module lookahead, execute in original order, resume interrupted loading without redeclarations. |
| Boundary selection | Missing source immediately stopped selection; open phone menus obstructed the map. | Reload through the shared coverage port, reject stale completions, close menu when selection starts, keep stored-feature recovery. |
| Cached thin objects | Stored narrow road polygons had no tolerance while live OSM selection allowed 8 m. | Apply the same 8 m selection tolerance, prefer containing polygons, preserve selected geometry exactly. |

Scientific raster, class areas, coefficients, QA/acceptance gates, RLS, stored accepted snapshots and frozen DOI artifacts are unchanged. This work does not certify OSM completeness against field truth.

## Verification

- New latency/recovery tests: native-first after degradation, first-mirror recovery, shared deadline, no immediate duplicate outage chain, missing source recovery, stale-selection rejection, bounded ordered preload, cached-road tolerance.
- First-click and synchronous-error cleanup tests; loader retry fixture now models non-executing preload links while retaining every retry/no-redeclaration assertion.
- Chromium and WebKit at 360/390/430 px: first-click result, real Leaflet polygon tap forwarding, cached building, thin road, missing-source recovery, unchanged geometry, no page errors or page-wide overflow.
- Live read-only native OSM probes: three small Ankara park scopes returned complete decoded geometry, with 126/1207/328 relevant objects respectively. No production records were changed.
- Existing phone suite, full source/test gate and CI are release requirements; see the final release report for recorded results.

External providers may still fail. Failed or partial evidence is never relabeled as complete. No unconditional response-time or accuracy guarantee is made.

References: [Overpass resource limits](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), [OSM API map and relation response structure](https://wiki.openstreetmap.org/wiki/API_v0.6).
