import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const paths=[
  'src/domain/surface/select-surface-brush-cells.js',
  'src/domain/surface/create-surface-cell-decision.js',
  'src/application/surface/surface-brush-history.js',
  'src/application/surface/migrate-legacy-brush-masks.js',
  'src/domain/surface/surface-geometry-overlap.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of paths)vm.runInContext(read(path),context,{filename:path});return window;}

test('brush selection keeps park clipping, bounds filtering, exact intersection and cell order',()=>{
  const window=setup(),events=[];
  const keys=window.DG_SURFACE_BRUSH_CELL_SELECTION.select({points:[[1,2]],diameter:10,epsg:32631,polygonClipping:{union:(...masks)=>{events.push(['union',...masks]);return['union'];},intersection:(a,b)=>{events.push(['intersection',a,b]);return a[0]==='union'?['brush']:[`hit-${a[0]}`];}},parkGeometry:['park'],geometry:{a:['cell-a'],b:['cell-b'],c:['cell-c']},cells:[{id:'a'},{id:'b'},{id:'c'}],cellKey:cell=>cell.id,gridLineMask:(line,epsg)=>{assert.equal(JSON.stringify(line),JSON.stringify({pts:[[1,2]],w:5}));assert.equal(epsg,32631);return['mask'];},bounds:geometry=>geometry,overlap:(a,b)=>b[0]!=='cell-b',area:intersection=>intersection[0]==='hit-cell-c'?.01:1});
  assert.deepEqual(JSON.parse(JSON.stringify(keys)),['a']);assert.deepEqual(events[0],['union','mask']);
});

test('cell decision preserves the visual-cell payload and rejects unknown classes',()=>{
  const window=setup(),cell={row:2,col:7,classKey:'green'},types={water:{}};
  assert.deepEqual(JSON.parse(JSON.stringify(window.DG_SURFACE_CELL_DECISION.create({cell,toClass:'water',types,timestamp:'2026-01-01T00:00:00Z',strokeId:'stroke-1',cellKey:c=>`${c.row}:${c.col}`}))),{key:'2:7',decision:{from:'green',to:'water',method:'visual-cell',ts:'2026-01-01T00:00:00Z',brushStrokeId:'stroke-1'}});
  assert.equal(window.DG_SURFACE_CELL_DECISION.create({cell,toClass:'unknown',types,cellKey:c=>`${c.row}:${c.col}`}),null);
});

test('brush history stays capped at twenty and undo restores only the still-owned decisions',()=>{
  const window=setup(),history=window.DG_SURFACE_BRUSH_HISTORY,record={corrections:{a:{brushStrokeId:'s1'},b:{brushStrokeId:'newer'}},brushHistory:[]};
  for(let i=0;i<21;i++)history.append(record,{id:`s${i}`,changes:[]});assert.equal(record.brushHistory.length,20);record.brushHistory=[{id:'s1',changes:[{key:'a',before:{from:'green'},strokeId:'s1'},{key:'b',before:null,strokeId:'s1'}]}];
  assert.equal(history.undoLatest(record),true);assert.deepEqual(JSON.parse(JSON.stringify(record.corrections)),{a:{from:'green'},b:{brushStrokeId:'newer'}});assert.equal(record.brushHistory.length,0);assert.equal(history.undoLatest(record),false);
});

test('legacy mask migration writes undoable cell decisions and removes only migrated masks',()=>{
  const window=setup(),history=window.DG_SURFACE_BRUSH_HISTORY,record={features:[{type:'water',method:'visual-brush',ts:'2026-01-01T00:00:00Z',geometry:'old-mask'},{type:'building',method:'visual-boundary'}],corrections:{'0:0':{from:'bare',to:'green'}}},cell={row:0,col:0,classKey:'green'},cells=[cell],geometries={'0:0':['cell']};
  const migrated=window.DG_LEGACY_BRUSH_MASK_MIGRATION.migrate({record,cells,geometries,park:['park'],epsg:32631,polygonClipping:{intersection:(a,b)=>a==='cell'?['intersection']:['clipped-mask']},featureGeometry:(feature,epsg)=>{assert.equal(feature.geometry,'old-mask');assert.equal(epsg,32631);return['projected-mask'];},bounds:()=>['bounds'],area:()=>1,overlap:()=>true,cellKey:c=>`${c.row}:${c.col}`,timestamp:()=> 'now',createDecision:args=>window.DG_SURFACE_CELL_DECISION.create({...args,types:{water:{}},cellKey:c=>`${c.row}:${c.col}`}),appendHistory:history.append});
  assert.equal(migrated,true);assert.equal(record.features.length,1);assert.equal(record.features[0].method,'visual-boundary');assert.equal(record.corrections['0:0'].to,'water');assert.equal(record.brushHistory.length,1);
  assert.equal(history.undoLatest(record),true);assert.deepEqual(JSON.parse(JSON.stringify(record.corrections['0:0'])),{from:'bare',to:'green'});
});

test('legacy mask migration preserves historical decisions even for unknown saved classes',()=>{
  const window=setup(),record={features:[{type:'legacy-class',method:'visual-brush'}],corrections:{}},cell={row:0,col:0,classKey:'green'};
  window.DG_LEGACY_BRUSH_MASK_MIGRATION.migrate({record,cells:[cell],geometries:{'0:0':['cell']},park:['park'],epsg:32631,polygonClipping:{intersection:a=>a==='cell'?['intersection']:['mask']},featureGeometry:()=>['old'],bounds:()=>['bounds'],area:()=>1,overlap:()=>true,cellKey:c=>`${c.row}:${c.col}`,timestamp:()=> 'now',createDecision:()=>null,appendHistory:window.DG_SURFACE_BRUSH_HISTORY.append});
  assert.equal(record.corrections['0:0'].to,'legacy-class');assert.equal(record.corrections['0:0'].method,'visual-cell');assert.equal(record.features.length,0);
});

test('geometry overlap keeps empty guards and delegates the same bounds predicate',()=>{
  const window=setup(),calls=[];assert.equal(window.DG_SURFACE_GEOMETRY_OVERLAP.bounds(['a'],[],()=>[],()=>true),false);
  assert.equal(window.DG_SURFACE_GEOMETRY_OVERLAP.bounds(['a'],['cell'],geometry=>{calls.push(geometry);return['bounds'];},(a,b)=>{calls.push([a,b]);return true;}),true);assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['cell'],[['a'],['bounds']]]);
});

test('five brush modules load and are precached before the surface review UI',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
  for(const path of paths){const script=`"${path}"`,asset=`'/${path}'`;assert.ok(chain.indexOf(script)>=0,`${path} lazy load`);assert.ok(sw.includes(asset),`${path} precache`);assert.ok(chain.indexOf(script)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} before UI`);}
  assert.match(ui,/DG_SURFACE_BRUSH_CELL_SELECTION/);assert.match(ui,/DG_SURFACE_CELL_DECISION/);assert.match(ui,/DG_SURFACE_BRUSH_HISTORY/);assert.match(ui,/DG_LEGACY_BRUSH_MASK_MIGRATION/);assert.match(ui,/DG_SURFACE_GEOMETRY_OVERLAP/);
});
