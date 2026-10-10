import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(withMap=true){
 const cells=[{id:1}],selection=new Set([1]),removed=[];
 const summary={innerHTML:'summary',style:{display:'block'}},gridControl={checked:false},waypointControl={checked:false};
 const state={window:{},DG_GRID_META:'meta',DG_GRID_SOURCE:{},DG_GRID_EPOCH:4,DG_GRID_RENDERER:{kind:'renderer'},GRID_LAYER:{kind:'grid'},WP_AUTO_LAYER:{kind:'waypoints'},GRID_CELLS:cells,SELECTED_CELLS:selection,map:withMap?{removeLayer:x=>removed.push(x.kind)}:null,$:id=>({gridSummary:summary,togGrid:gridControl,togWp:waypointControl})[id]};
 const context=vm.createContext(state);
 vm.runInContext(readFileSync(new URL('../src/ui/grid-reset.js',import.meta.url),'utf8'),context);
 const service=readFileSync(new URL('../src/services/grid-engine.js',import.meta.url),'utf8');
 vm.runInContext(service.slice(service.indexOf('function clearGrid(){'),service.indexOf('\nfunction toggleGridVis()')),context);
 return{context,cells,selection,removed,summary,gridControl,waypointControl};
}
test('clear invalidates pending builds and clears containers without replacing them',()=>{
 const x=setup();x.context.clearGrid();assert.equal(x.context.DG_GRID_EPOCH,5);assert.equal(x.context.DG_GRID_META,'');assert.equal(x.context.DG_GRID_SOURCE,null);assert.strictEqual(x.context.GRID_CELLS,x.cells);assert.strictEqual(x.context.SELECTED_CELLS,x.selection);assert.equal(x.cells.length,0);assert.equal(x.selection.size,0);assert.deepEqual(x.removed,['renderer','grid','waypoints']);assert.equal(x.context.GRID_LAYER,null);assert.equal(x.context.WP_AUTO_LAYER,null);assert.equal(x.summary.style.display,'none');assert.equal(x.summary.innerHTML,'');assert.equal(x.gridControl.checked,true);assert.equal(x.waypointControl.checked,true);
});
test('repeated clear does not remove already cleared layers',()=>{
 const x=setup();x.context.clearGrid();x.context.clearGrid();assert.deepEqual(x.removed,['renderer','grid','waypoints']);assert.equal(x.context.DG_GRID_EPOCH,6);
});
test('missing map retains grid and waypoint references while clearing local selection',()=>{
 const x=setup(false),grid=x.context.GRID_LAYER,wp=x.context.WP_AUTO_LAYER;x.context.clearGrid();assert.equal(x.context.DG_GRID_RENDERER,null);assert.strictEqual(x.context.GRID_LAYER,grid);assert.strictEqual(x.context.WP_AUTO_LAYER,wp);assert.equal(x.cells.length,0);assert.equal(x.selection.size,0);assert.equal(x.context.DG_GRID_EPOCH,5);
});
