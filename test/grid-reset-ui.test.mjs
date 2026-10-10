import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(withMap=true){
 const cells=[{id:1}],selection=new Set([1]),removed=[];
 const summary={innerHTML:'summary',style:{display:'block'}},gridControl={checked:false},waypointControl={checked:false};
 const state={window:{},GRID_CELLS:cells,SELECTED_CELLS:selection,map:withMap?{removeLayer:x=>removed.push(x.kind)}:null,$:id=>({gridSummary:summary,togGrid:gridControl,togWp:waypointControl})[id]};
 const context=vm.createContext(state);
 vm.runInContext(readFileSync(new URL('../src/ui/grid-reset.js',import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../src/application/parks/grid-session-state.js',import.meta.url),'utf8'),context);
 context.DG_GRID_SESSION=context.window.DG_GRID_SESSION_STATE.create({cells,selection});
 for(let i=0;i<4;i++)context.DG_GRID_SESSION.nextEpoch();
 context.DG_GRID_SESSION.setGridLayer({kind:'grid'});context.DG_GRID_SESSION.setWaypointLayer({kind:'waypoints'});
 context.DG_GRID_SESSION.setMeta('meta');context.DG_GRID_SESSION.setSource({});context.DG_GRID_SESSION.setRenderer({kind:'renderer'});
 const service=readFileSync(new URL('../src/services/grid-engine.js',import.meta.url),'utf8');
 vm.runInContext(service.slice(service.indexOf('function clearGrid(){'),service.indexOf('\nfunction toggleGridVis()')),context);
 return{context,cells,selection,removed,summary,gridControl,waypointControl};
}
test('clear invalidates pending builds and clears containers without replacing them',()=>{
 const x=setup();x.context.clearGrid();assert.equal(x.context.DG_GRID_SESSION.getEpoch(),5);assert.equal(x.context.DG_GRID_SESSION.getMeta(),'');assert.equal(x.context.DG_GRID_SESSION.getSource(),null);assert.strictEqual(x.context.GRID_CELLS,x.cells);assert.strictEqual(x.context.SELECTED_CELLS,x.selection);assert.equal(x.cells.length,0);assert.equal(x.selection.size,0);assert.deepEqual(x.removed,['renderer','grid','waypoints']);assert.equal(x.context.DG_GRID_SESSION.getGridLayer(),null);assert.equal(x.context.DG_GRID_SESSION.getWaypointLayer(),null);assert.equal(x.summary.style.display,'none');assert.equal(x.summary.innerHTML,'');assert.equal(x.gridControl.checked,true);assert.equal(x.waypointControl.checked,true);
});
test('repeated clear does not remove already cleared layers',()=>{
 const x=setup();x.context.clearGrid();x.context.clearGrid();assert.deepEqual(x.removed,['renderer','grid','waypoints']);assert.equal(x.context.DG_GRID_SESSION.getEpoch(),6);
});
test('missing map retains grid and waypoint references while clearing local selection',()=>{
 const x=setup(false),grid=x.context.DG_GRID_SESSION.getGridLayer(),wp=x.context.DG_GRID_SESSION.getWaypointLayer();x.context.clearGrid();assert.equal(x.context.DG_GRID_SESSION.getRenderer(),null);assert.strictEqual(x.context.DG_GRID_SESSION.getGridLayer(),grid);assert.strictEqual(x.context.DG_GRID_SESSION.getWaypointLayer(),wp);assert.equal(x.cells.length,0);assert.equal(x.selection.size,0);assert.equal(x.context.DG_GRID_SESSION.getEpoch(),5);
});
