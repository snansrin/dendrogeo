# Surface menu event ownership — 16 October 2026

Baseline: `9804a54`; branch: `fix/surface-menu-event-ownership-20261016`.

## Reproduced cause

`dgSensRenderPaintTools` renders the surface menus inside `surfaceBrushTools` and binds delegated events to that container. `DG_PARK_MENU_UI.arrange` then reparents those same menu nodes into the sibling `surfaceMenuBar`. Events from the moved buttons no longer reach their original delegation container. Object selection, boundary class changes and drawing commands in the menu therefore do nothing, even though direct tool-rail actions and isolated use-case fixtures can succeed.

The new real-application phone regression failed before the fix with `false !== true` immediately after tapping the moved object-selection button.

## Correction

Bind the existing surface-editor action map to `surfaceMenuBar` after arrangement. The existing binder uses a WeakSet to install one listener set per container. The original host remains bound for fallback placement; the tool rail remains bound separately. The menu renderer, application actions, geometry engine, accepted snapshots, source raster and current theme are unchanged.

## Verification

`scripts/surface-menu-smoke.mjs` loads the complete generated application with an isolated synthetic account and park. At 360, 390 and 430 px it checks:

- The real menu is under `surfaceMenuBar`, outside its original event host.
- A tap on the actual menu button activates object picking, then a real Leaflet map tap opens the stored building preview.
- The actual class select changes the drawing class.
- The actual drawing button starts a drawing; three map taps add exactly three vertices; Escape cancels without adding a correction.
- Repeated menu rendering preserves working handlers.

The regression is included in the Chromium phone suite and the WebKit CI job. Existing drawing completion/continuous-session and brush tests remain in the full phone suite. No production account or scientific record is written by the tests.
