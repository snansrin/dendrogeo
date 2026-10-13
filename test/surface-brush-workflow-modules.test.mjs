import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/adapters/surface/surface-brush-pointer-session.js','src/domain/surface/validate-surface-brush-stroke.js','src/application/surface/commit-surface-brush-stroke.js','src/application/surface/undo-surface-brush-stroke.js','src/application/surface/update-surface-brush-config.js'];
function setup(){const window={};const context=vm.createContext({window,Math,Promise});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('brush stroke validator enforces WGS84, 300 points, supported classes and sizes',()=>{
  const validate=setup().DG_VALIDATE_SURFACE_BRUSH_STROKE.valid,base={points:[[41,29],[41.1,29.1]],type:'water',diameter:10,types:{water:{}},allowed:[5,10,20,40]};
  assert.equal(validate(base),true);assert.equal(validate({...base,points:[[91,29]]}),false);assert.equal(validate({...base,points:Array.from({length:301},()=>[41,29])}),false);assert.equal(validate({...base,type:'unknown'}),false);assert.equal(validate({...base,diameter:12}),false);
});

test('brush pointer adapter captures primary strokes and restores map state on stop',()=>{
  const window=setup(),listeners={},events=[],added=[],layer={addTo(){return this;}},container={style:{touchAction:'pan-x',cursor:'grab'},classList:{add:()=>events.push('active'),remove:()=>events.push('inactive')},addEventListener:(name,fn)=>{listeners[name]=fn;},removeEventListener:()=>{},setPointerCapture:id=>events.push(`capture:${id}`),releasePointerCapture:id=>events.push(`release:${id}`)};
  const interaction=()=>({value:true,enabled(){return this.value;},disable(){this.value=false;},enable(){this.value=true;}}),map={dragging:interaction(),doubleClickZoom:interaction(),mouseEventToLatLng:()=>({lat:41,lng:29}),removeLayer:()=>events.push('remove')},state={record:{},epoch:2,epsg:32636,busy:false,saving:false};
  const leaflet={layerGroup:()=>({addTo(){return layer;}}),polyline:()=>({addTo:()=>added.push('line')}),circle:()=>({addTo:()=>added.push('circle')})};
  window.DG_SURFACE_BRUSH_POINTER_SESSION.start({state,map,leaflet,container,type:'water',diameter:10,colors:{water:'#00f'},forward:(lat,lon)=>({x:lat,y:lon}),onCommit:async()=>{},onError:()=>{},render:()=>events.push('render')});
  assert.equal(state.brush.handlers.length,5);assert.equal(map.dragging.enabled(),false);assert.equal(map.doubleClickZoom.enabled(),false);const event={button:0,isPrimary:true,pointerId:9,target:{closest:()=>false},preventDefault(){},stopImmediatePropagation(){}};listeners.pointerdown(event);assert.ok(state.brush.stroke);assert.ok(added.includes('circle'));window.DG_SURFACE_BRUSH_POINTER_SESSION.stop({state,map});assert.equal(state.brush,null);assert.equal(map.dragging.enabled(),true);assert.equal(map.doubleClickZoom.enabled(),true);assert.equal(container.style.touchAction,'pan-x');assert.ok(events.includes('release:9'));
});

test('brush commit preserves per-cell provenance, history, refresh order and save gate',async()=>{
  const window=setup(),events=[],record={corrections:{}},state={record,rawView:false,busy:false,saving:false},result=await window.DG_COMMIT_SURFACE_BRUSH_STROKE.commit({points:[[41,29]],type:'water',diameter:10,state,types:{water:{}},allowed:[5,10,20,40],validate:window.DG_VALIDATE_SURFACE_BRUSH_STROKE.valid,selectCells:()=>['1:2'],cells:()=>[{row:1,col:2,classKey:'green'}],cellKey:cell=>`${cell.row}:${cell.col}`,createDecision:(cell,to,ts,id)=>{const applied={key:'1:2',decision:{from:cell.classKey,to,ts,method:'visual-cell',brushStrokeId:id}};record.corrections[applied.key]=applied.decision;return applied;},appendHistory:(target,stroke)=>target.brushHistory=[stroke],timestamp:()=> 'now',strokeId:()=> 'stroke-1',dirty:()=>events.push('dirty'),refresh:()=>events.push('refresh'),summary:()=>events.push('summary'),status:()=>events.push('status'),save:async()=>events.push('save')});
  assert.equal(result,undefined);assert.equal(record.corrections['1:2'].brushStrokeId,'stroke-1');assert.deepEqual(events,['dirty','refresh','summary','status','save']);assert.equal(record.brushHistory[0].changes[0].before,null);
});

test('brush undo restores only decisions still owned by the latest stroke',()=>{
  const window=setup(),events=[],record={corrections:{a:{to:'water',brushStrokeId:'s1'},b:{to:'hard',brushStrokeId:'later'}},brushHistory:[{changes:[{key:'a',before:{to:'green'},strokeId:'s1'},{key:'b',before:null,strokeId:'s1'}]}]};
  const changed=window.DG_UNDO_SURFACE_BRUSH_STROKE.undo({record,rawView:false,busy:false,saving:false,historyModule:null,dirty:()=>events.push('dirty'),refresh:()=>events.push('refresh'),summary:()=>events.push('summary'),status:()=>events.push('status'),save:()=>events.push('save')});
  assert.equal(changed,true);assert.equal(record.corrections.a.to,'green');assert.equal(record.corrections.b.brushStrokeId,'later');assert.deepEqual(events,['dirty','refresh','summary','status','save']);
});

test('brush config retains valid settings, ignores unsupported values, then stops and renders',()=>{
  const window=setup(),events=[],state={brushType:'hard',brushDiameter:5},result=window.DG_UPDATE_SURFACE_BRUSH_CONFIG.update({state,type:'water',size:20,types:{water:{}},allowed:[5,10,20,40],stop:()=>events.push('stop'),render:()=>events.push('render')});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{type:'water',size:20});assert.deepEqual(events,['stop','render']);window.DG_UPDATE_SURFACE_BRUSH_CONFIG.update({state,type:'bad',size:6,types:{water:{}},allowed:[5,10,20,40],stop:()=>{},render:()=>{}});assert.equal(state.brushType,'water');assert.equal(state.brushDiameter,20);
});

test('five brush workflow modules are loaded and precached before locked UI',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}
  for(const name of ['DG_SURFACE_BRUSH_POINTER_SESSION','DG_VALIDATE_SURFACE_BRUSH_STROKE','DG_COMMIT_SURFACE_BRUSH_STROKE','DG_UNDO_SURFACE_BRUSH_STROKE','DG_UPDATE_SURFACE_BRUSH_CONFIG'])assert.ok(ui.includes(name));
});
