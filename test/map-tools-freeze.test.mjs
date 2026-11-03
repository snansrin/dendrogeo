import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const manifest=JSON.parse(fs.readFileSync(new URL('../docs/core-foundation-lock.json',import.meta.url),'utf8'));
test('the approved analysis engines, map tools, menus and regression coverage remain explicitly frozen',()=>{
 const scope=new Set(manifest.categories.frozen_map_engines_tools_menus_2026_11_03);
 assert.ok(scope.size>=700,'engine/tool protection scope must remain comprehensive');
 for(const path of ['src/services/landcover.js','src/services/osm-client.js','src/services/park-query.js','src/ui/lc-sens.js','src/ui/render-surface-editor-menus.js','src/ui/render-surface-editor-tool-rail.js','src/ui/park-menu-ui.js','src/ui/park-stage-workspace.js','src/ui/grid-waypoint-layer.js','src/ui/park-waypoint-workspace.js','src/bootstrap/live-map-project-workspace.js','css/park-panel.css','css/live-map-project-workspace.css','scripts/measurement-point-toolbar-smoke.mjs','scripts/surface-menu-smoke.mjs','test/map-tools-freeze.test.mjs']){
  assert.ok(scope.has(path),'missing frozen component: '+path);assert.match(manifest.sha256[path]||'',/^[a-f0-9]{64}$/);
 }
 for(const path of scope)assert.ok(Object.hasOwn(manifest.sha256,path),'unhashed frozen path: '+path);
});
