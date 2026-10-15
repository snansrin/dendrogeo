import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/waypoint-actions.js',import.meta.url),'utf8');

test('waypoint controls delegate field actions without inline event attributes',()=>{
  const listeners=new Map(),calls=[];
  const ctx={document:{addEventListener:(name,handler)=>listeners.set(name,handler)},navMap:{invalidateSize(){calls.push('invalidate');}}};
  for(const name of ['loadWaypoints','dgNearestWaypoint','dgNextWaypoint','dgFocusWaypoint','dgFitWaypoints','startGps','arriveWp','renderWaypointList','dgFileName','uploadWpCsv','deleteAllWaypoints'])ctx[name]=(...args)=>calls.push([name,...args]);
  ctx.window=ctx;vm.runInContext(source,vm.createContext(ctx));
  const dispatch=(type,action,extra={})=>{const element={dataset:{dgWaypointAction:action},...extra};const dispatched={target:{...extra.event?.target,closest:selector=>selector==='[data-dg-waypoint-action]'?element:null}};listeners.get(type)(dispatched);return dispatched;};
  dispatch('change','load');dispatch('click','nearest');dispatch('click','focus');dispatch('input','render');
  const fileEvent={target:{files:[{}]}};const dispatchedFileEvent=dispatch('change','file-name',{event:fileEvent});
  dispatch('click','map-panel',{open:true});dispatch('toggle','map-panel',{open:true});
  assert.deepEqual(calls.slice(0,4),[['loadWaypoints'],['dgNearestWaypoint'],['dgFocusWaypoint',true],['renderWaypointList']]);
  assert.equal(calls[4][0],'dgFileName');assert.equal(calls[4][1],dispatchedFileEvent);assert.equal(calls[4][2],'nCsvName');
  assert.deepEqual(calls.slice(5), ['invalidate',['dgFocusWaypoint']]);
});

test('waypoint action script is ordered and cached offline',()=>{
  const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(boot,/shell-nav-actions\.js[\s\S]*waypoint-actions\.js/);
  assert.match(sw,/'\/src\/ui\/waypoint-actions\.js'/);
});
