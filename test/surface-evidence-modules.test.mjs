import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/classify-surface-scan-audit.js','src/ui/render-surface-scan-audit.js','src/domain/surface/classify-surface-vegetation-tiers.js','src/domain/surface/build-surface-vegetation-parts.js','src/ui/render-surface-vegetation-features.js'];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('spectral audit counts missing and ambiguous samples and ranks disagreements by area',()=>{
  const window=setup(),cells=[{key:'a',classKey:'green',areaM2:20},{key:'b',classKey:'water',areaM2:10},{key:'c',classKey:'hard',areaM2:5},{key:'d',classKey:'bare',areaM2:1}],profile={cells:{a:{prediction:'green'},b:{prediction:'hard'},c:{prediction:'unknown'}},scenes:[{datetime:'2024-02-01',usedCells:1},{datetime:'2024-01-01',usedCells:0},{datetime:'2024-01-02',usedCells:1}],stats:{nProfiled:3},skipped:[{}],range:{start:'2024-01-01',end:'2024-02-01'}};
  const model=window.DG_CLASSIFY_SURFACE_SCAN_AUDIT.build({cells,profile,classes:['green','water','hard','bare'],cellKey:cell=>cell.key,spectralPredict:e=>e.prediction});
  assert.deepEqual(JSON.parse(JSON.stringify({total:model.total,profiled:model.profiled,usable:model.usable,matched:model.matched,ambiguous:model.ambiguous,missing:model.missing,scenes:model.scenes.map(x=>x.datetime),skipped:model.skipped,transition:model.transitions[0]})),{total:4,profiled:3,usable:2,matched:1,ambiguous:1,missing:1,scenes:['2024-01-02','2024-02-01'],skipped:1,transition:{from:'water',to:'hard',cells:1,areaM2:10}});
});

test('audit view preserves explanatory copy, scene range and escaped transitions',()=>{
  const window=setup(),html=window.DG_RENDER_SURFACE_SCAN_AUDIT.render({audit:{scenes:[{datetime:'2024-05-03'}],range:null,skipped:0,profiled:1,total:1,usable:1,matched:0,ambiguous:0,missing:0,transitions:[{from:'water',to:'<hard>',cells:2,areaM2:1234}]},translate:x=>x,escape:x=>x.replaceAll('<','&lt;').replaceAll('>','&gt;'),meta:key=>({tr:key}),hectares:x=>(x/10000).toFixed(3),sectionsOpen:false});
  assert.match(html,/2024-05-03/);assert.match(html,/&lt;hard&gt;/);assert.match(html,/bağımsız doğruluk ölçümü değildir/);assert.doesNotMatch(html,/>open/);
});

test('vegetation tiers need three observations and preserve tied quantile classes',()=>{
  const window=setup(),cells=Array.from({length:10},(_,i)=>({id:String(i),classKey:'green'})),profile=Object.fromEntries(cells.map((cell,i)=>[cell.id,{ndviMedianYear:i<2?.25:i,yearObs:i===9?2:3}]));
  const model=window.DG_CLASSIFY_SURFACE_VEGETATION_TIERS.build({cells,profile,cellKey:cell=>cell.id,effectiveClass:cell=>cell.classKey});
  assert.equal(model.count,9);assert.equal(model.eligible,10);assert.equal(model.tiers.get('0'),'sparse');assert.equal(model.tiers.get('1'),'sparse');assert.ok(Math.abs(model.cutoffs[0]-8/3)<1e-12);assert.ok(Math.abs(model.cutoffs[1]-16/3)<1e-12);
});

test('vegetation parts include only tiered cells with prepared geometry',()=>{
  const window=setup(),parts=window.DG_BUILD_SURFACE_VEGETATION_PARTS.build({cells:[{id:'a',areaM2:12},{id:'b',areaM2:7},{id:'c',areaM2:8}],tiers:new Map([['a','dense'],['b','sparse'],['c','moderate']]),geometry:{a:[[[1,2]]],c:[]},cellKey:cell=>cell.id});
  assert.deepEqual(JSON.parse(JSON.stringify(parts)),[{type:'dense',geom:[[[1,2]]],areaM2:12}]);
});

test('vegetation renderer clears, creates and draws noninteractive polygons in leaflet order',()=>{
  const window=setup(),calls=[],layer={clearLayers:()=>calls.push('clear')},feature={properties:{class:'sparse'},geometry:{coordinates:[[[[10,20],[11,21],[12,22]]]]}};
  const out=window.DG_RENDER_SURFACE_VEGETATION_FEATURES.render({features:[feature],opacity:45,renderer:'canvas',colors:{sparse:'#abc',moderate:'#def'},layer:null,createLayer:()=>{calls.push('create');return layer;},addLayer:(polygon,target)=>{assert.equal(target,layer);calls.push(polygon);},polygon:(rings,style)=>({rings,style})});
  assert.equal(out,layer);assert.equal(calls[0],'create');assert.equal(calls[1],'clear');assert.deepEqual(JSON.parse(JSON.stringify(calls[2])),{rings:[[[[20,10],[21,11],[22,12]]]],style:{renderer:'canvas',stroke:false,weight:0,interactive:false,fillColor:'#abc',fillOpacity:.45}});
});

test('five evidence modules are lazy loaded and precached before locked surface UI',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}
  for(const name of ['DG_CLASSIFY_SURFACE_SCAN_AUDIT','DG_RENDER_SURFACE_SCAN_AUDIT','DG_CLASSIFY_SURFACE_VEGETATION_TIERS','DG_BUILD_SURFACE_VEGETATION_PARTS','DG_RENDER_SURFACE_VEGETATION_FEATURES'])assert.ok(ui.includes(name));
});
