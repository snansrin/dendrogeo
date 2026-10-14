import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/surface-boundary-point-policy.js','src/domain/surface/prepare-surface-boundary.js','src/ui/surface-boundary-drawing-preview.js','src/ui/surface-boundary-drawing-session.js','src/application/surface/finish-surface-boundary-drawing.js'];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('park point policy preserves allowed fallback when the gate is missing or throws',()=>{
  const window=setup(),policy=window.DG_SURFACE_BOUNDARY_POINT_POLICY;
  assert.equal(policy.isInside({lat:1,lon:2,pointInPark:null,parkPolygon:[]}),true);assert.equal(policy.isInside({lat:1,lon:2,pointInPark:()=>{throw Error('unavailable');},parkPolygon:[]}),true);assert.equal(policy.isInside({lat:1,lon:2,pointInPark:(lat,lon)=>lat===1&&lon===2,parkPolygon:[]}),true);
});

test('boundary preparation validates the ring, clips in park geometry and preserves the area floor',()=>{
  const window=setup(),calls=[],valid=window.DG_PREPARE_SURFACE_BOUNDARY.prepare({ring:[[1,2]],epsg:32631,parkGeometry:['park'],validRing:()=>true,project:(ring,epsg)=>{calls.push(['project',ring,epsg]);return['projected'];},clip:(op,...geometry)=>{calls.push(['clip',op,...geometry]);return['clipped'];},area:()=>.1});
  assert.deepEqual(JSON.parse(JSON.stringify(valid)),{kind:'ready',geometry:['clipped']});assert.deepEqual(calls.map(call=>call[0]),['project','clip']);
  assert.equal(window.DG_PREPARE_SURFACE_BOUNDARY.prepare({ring:[],validRing:()=>false}).kind,'invalid-ring');
  assert.equal(window.DG_PREPARE_SURFACE_BOUNDARY.prepare({ring:[],validRing:()=>true,project:()=>[],clip:()=>{throw Error('topology');}}).kind,'clip-error');
  assert.equal(window.DG_PREPARE_SURFACE_BOUNDARY.prepare({ring:[],validRing:()=>true,project:()=>[],clip:()=>[],area:()=>.099}).kind,'outside-or-small');
});

test('drawing preview keeps existing line, closure and vertex styling',()=>{
  const window=setup(),calls=[],layer={id:2},map={removeLayer:value=>calls.push(['remove',value])},leaflet={layerGroup:()=>({addTo:target=>{assert.equal(target,map);return layer;}}),polyline:(points,style)=>{calls.push(['line',points,style]);return{addTo:()=>{}};},circleMarker:(point,style)=>{calls.push(['point',point,style]);return{addTo:()=>{}};}},draw={type:'water',ring:[[1,2],[3,4],[5,6]]};
  assert.equal(window.DG_SURFACE_BOUNDARY_DRAWING_PREVIEW.render({map,leaflet,draw,colors:{water:'#00f'}}),layer);assert.deepEqual(calls.filter(call=>call[0]==='line').map(call=>call[2].dashArray),['5 5','2 6']);assert.equal(calls.filter(call=>call[0]==='point').length,3);assert.equal(calls[0][0],'line');
});

test('drawing session preserves guards, event sequence, coordinate order and 300-point cap',()=>{
  const window=setup(),events=[],map={invalidateSize:()=>events.push('invalidate'),on:(name,fn)=>events.push(['on',name,fn])};let draw={type:'building',ring:[]};const base={rawView:false,busy:false,saving:false,draw:null,openMenu:()=>events.push('menu'),cancelObject:()=>events.push('object'),stopBrush:()=>events.push('brush'),map,selectedType:'water',setDraw:value=>{draw=value;events.push('draw');},setStatus:()=>events.push('status'),translate:value=>value,updateStatus:()=>events.push('update'),guard:value=>events.push(['guard',value]),drawPoint:()=>{},renderTools:()=>events.push('tools')};
  window.DG_SURFACE_BOUNDARY_DRAWING_SESSION.start(base);assert.deepEqual(events.map(value=>Array.isArray(value)?value[0]:value),['object','brush','invalidate','draw','status','update','guard','on','tools','menu']);assert.equal(draw.type,'water');
  const pointEvents=[];window.DG_SURFACE_BOUNDARY_DRAWING_SESSION.addPoint({draw,event:{latlng:{lat:40,lng:29}},insidePark:()=>false,setStatus:()=>pointEvents.push('outside'),translate:value=>value,updateStatus:()=>pointEvents.push('status'),render:()=>pointEvents.push('render'),renderTools:()=>pointEvents.push('tools')});assert.deepEqual(pointEvents,['outside','status']);
  window.DG_SURFACE_BOUNDARY_DRAWING_SESSION.addPoint({draw,event:{latlng:{lat:40,lng:29}},insidePark:()=>true,setStatus:()=>{},translate:value=>value,updateStatus:()=>{},render:()=>pointEvents.push('render'),renderTools:()=>pointEvents.push('tools')});assert.equal(JSON.stringify(draw.ring),JSON.stringify([[29,40]]));assert.deepEqual(pointEvents.slice(-2),['render','tools']);
  draw.ring=Array.from({length:300},()=>[0,0]);window.DG_SURFACE_BOUNDARY_DRAWING_SESSION.addPoint({draw,event:{latlng:{lat:40,lng:29}},insidePark:()=>true,setStatus:()=>{},translate:value=>value,updateStatus:()=>{},render:()=>pointEvents.push('render'),renderTools:()=>pointEvents.push('tools')});assert.equal(draw.ring.length,300);
});

test('finish stores the legacy draft payload and saves before a required water scan',async()=>{
  const window=setup(),events=[],record={features:[]},draw={type:'water',ring:[[1,2],[3,4],[5,6]]};
  await window.DG_FINISH_SURFACE_BOUNDARY_DRAWING.finish({draw,prepare:()=>({kind:'ready',geometry:['validated'] }),showInvalid:()=>{},showClipError:()=>{},showOutside:()=>{},record:()=>record,timestamp:()=> '2026-01-01T00:00:00Z',markDirty:()=>events.push('dirty'),cancel:()=>events.push('cancel'),renderTools:()=>events.push('tools'),repartition:async()=>{events.push('partition');return true;},save:async()=>events.push('save'),needsWaterScan:()=>true,setStatus:()=>events.push('status'),updateStatus:()=>events.push('update'),scan:async()=>events.push('scan'),translate:value=>value});
  assert.deepEqual(JSON.parse(JSON.stringify(record.features[0])),{type:'water',ring:[[1,2],[3,4],[5,6]],method:'visual-boundary',ts:'2026-01-01T00:00:00Z'});assert.deepEqual(events,['dirty','cancel','tools','partition','save','status','update','scan']);
});

test('five boundary modules load and are precached before the locked review UI',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}
  assert.match(ui,/DG_SURFACE_BOUNDARY_POINT_POLICY/);assert.match(ui,/DG_PREPARE_SURFACE_BOUNDARY/);assert.match(ui,/DG_SURFACE_BOUNDARY_DRAWING_PREVIEW/);assert.match(ui,/DG_SURFACE_BOUNDARY_DRAWING_SESSION/);assert.match(ui,/DG_FINISH_SURFACE_BOUNDARY_DRAWING/);
});
