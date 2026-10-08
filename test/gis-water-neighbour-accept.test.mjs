import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const key=(row,col)=>row+':'+col;
function fixture(options={}){
 const rec={
  id:'surface-goksu',parkId:'goksu',owner:'user',fingerprint:'baseline-c2',
  features:[{type:'water',method:'visual-boundary'}],
  corrections:{'4:5':{from:'water',to:'hard',method:'visual-cell',ts:'original'}},
  acceptedResult:{schema:'dendrogeo-surface/2',areas:{water:120000,hard:65000},acceptedAt:'2026-10-06',id:'previous'},
  draftDirty:true,
  ...options.record
 };
 const state={record:rec,editing:true,rawView:false,busy:false,saving:false,
  epoch:3,partitionVersion:9,visualVersion:2,geometry:{ready:true},...options.state};
 const outside=Array.from({length:69},(_,i)=>{
  const row=5+Math.floor(i/12),col=i%12;
  return {key:key(row,col),type:'other',method:'review-cell',areaM2:100,
   cell:{row,col,classKey:'water',rasterClassKey:'water',areaM2:100,
    center:{lat:39.95+row*.00009,lon:32.65+col*.00011}}};
 });
 const known=[
  {key:'0:0',type:'green',method:'review-cell',areaM2:100,
   cell:{row:0,col:0,classKey:'green',center:{lat:39.95,lon:32.65}}},
  {key:'0:12',type:'hard',method:'review-cell',areaM2:100,
   cell:{row:0,col:12,classKey:'hard',center:{lat:39.95,lon:32.65132}}},
  {key:'12:6',type:'bare',method:'review-cell',areaM2:100,
   cell:{row:12,col:6,classKey:'bare',center:{lat:39.95108,lon:32.65066}}},
  {key:'4:5',type:'hard',method:'review-cell',areaM2:100,
   cell:{row:4,col:5,classKey:'water',center:{lat:39.95036,lon:32.65055}}}
 ];
 const parts=[...outside,...known];
 let dirty=0,saves=0,summary=0,render=0,status=0;
 const pending=()=>parts.map(p=>rec.corrections[p.key]&&p.type==='other'?
  {...p,type:rec.corrections[p.key].to}:p);
 const doc={readyState:'loading',getElementById:()=>null,addEventListener(){}};
 const scope={
  window:{DG_LC_SENS:{state}},document:doc,console,setTimeout,clearTimeout,Date,
  dgSensParts:pending,
  dgSensDirty(){dirty++;rec.draftDirty=true;state.visualVersion++;},
  dgSensSave(){saves++;return Promise.resolve(true);},
  dgSensRefreshLayer(){render++;return Promise.resolve();},
  dgSensUpdateSummary(){summary++;},
  dgSensUpdateStatus(){status++;},
  dgSensWaterBoundaryUnresolved:()=>pending().filter(p=>p.method==='review-cell'&&p.cell.classKey==='water'&&p.type==='other').length
 };
 vm.runInNewContext(read('src/ui/gis-water-neighbour.js'),scope);
 return{api:scope.window.DG_GIS_WATER_NEIGHBOUR,scope,record:rec,state,outside,known,parts,
  stats:()=>({dirty,saves,summary,render,status}),pending};
}
test('69 Göksu-like receded water cells: propose unique land only, never water/building or an extra class',()=>{
 const f=fixture(),proposal=f.api.propose(f.pending(),f.record.corrections);
 assert.equal(proposal.length,69);
 assert.equal(new Set(proposal.map(p=>p.key)).size,69);
 assert.ok(proposal.every(p=>['green','hard','bare'].includes(p.to)));
 assert.ok(proposal.every(p=>Number.isFinite(p.distanceM)&&p.distanceM>=0));
 assert.ok(proposal.every(p=>p.neighbour!==p.key));
});
test('applying 69 inferred corrections releases the original locked acceptance gate without bypassing it',()=>{
 const f=fixture();
 const acceptedBefore=structuredClone(f.record.acceptedResult);
 const sourceBefore=structuredClone(f.parts);
 assert.equal(f.scope.dgSensWaterBoundaryUnresolved(),69);
 const r=f.api.apply();
 assert.equal(r.count,69);
 assert.equal(r.remaining,0);
 assert.equal(f.scope.dgSensWaterBoundaryUnresolved(),0);
 assert.deepEqual(f.record.acceptedResult,acceptedBefore,'never edit previously accepted report');
 assert.deepEqual(f.parts,sourceBefore,'do not change input raster cells, geometry or source parts');
 assert.deepEqual(f.record.corrections['4:5'],{from:'water',to:'hard',method:'visual-cell',ts:'original'});
 assert.equal(Object.keys(f.record.corrections).length,70);
 for(const c of f.outside){
  const correction=f.record.corrections[c.key];
  assert.ok(['green','hard','bare'].includes(correction.to));
  assert.equal(correction.from,'water');
  assert.equal(correction.method,'visual-cell','locked engine requires explicit decision record');
  assert.equal(correction.source,'spatial-nearest-inference');
  assert.match(correction.evidence.classification,/not-satellite/);
  assert.ok(Number.isFinite(correction.evidence.distanceM));
 }
 assert.equal(f.stats().dirty,1);
 assert.equal(f.stats().saves,1);
 assert.equal(f.stats().render,1);
 assert.equal(f.api.apply().count,0,'repeat is idempotent');
 assert.equal(f.stats().saves,1);
});
test('conserve full-cell total area in 69-cell water/land redistribution without inventing new park area',()=>{
 const f=fixture(),baseArea=f.outside.reduce((a,b)=>a+b.areaM2,0);
 const r=f.api.apply();
 const inferred=f.outside.reduce((a,p)=>a+((f.record.corrections[p.key]?.to)?p.areaM2:0),0);
 assert.equal(baseArea,6900);
 assert.equal(inferred,baseArea);
 assert.equal(Object.values(r.byClass).reduce((a,b)=>a+b,0),69);
 assert.equal(Object.keys(r.byClass).some(k=>!['green','hard','bare'].includes(k)),false);
});
test("never overwrite user decisions or assign without confirmed neighbour evidence",()=>{
 const f=fixture({record:{corrections:{'5:0':{from:'water',to:'bare',method:'visual-cell',ts:'manual'}}}});
 const before=structuredClone(f.record.corrections['5:0']);
 assert.equal(f.api.apply().count,68);
 assert.deepEqual(f.record.corrections['5:0'],before);
 const g=fixture();
 assert.equal(g.api.propose(g.outside,g.record.corrections).length,0,'missing neighbouring land => no fabricated assignments');
});
test('no changes to locked source acceptance, scientific engine or published source; helper is precached',()=>{
 const lock=JSON.parse(read('docs/surface-engine-lock.json'));
 const src=read('src/ui/gis-water-neighbour.js'),core=read('src/ui/lc-sens.js');
 assert.equal(Object.keys(lock.locked_files).length,51);
 assert.ok(!lock.locked_files['src/ui/gis-water-neighbour.js']);
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
 assert.match(core,/decision\.method==="visual-cell"/);
 assert.match(core,/dgSensWaterBoundaryUnresolved\(\)>0\?/);
 assert.doesNotMatch(src,/dgSensAccept\s*=|dgSensEffective\s*=|acceptedResult\s*=|dgSensWaterOutsideClass\s*=/);
 assert.match(src,/source:"spatial-nearest-inference"/);
 assert.match(read('index.html'),/src\/ui\/gis-water-neighbour\.js\?v=[a-f0-9]{8}/);
 assert.match(read('partials/boot.html'),/src\/ui\/gis-water-neighbour\.js\?v=[a-f0-9]{8}/);
 assert.match(read('sw.js'),/\/src\/ui\/gis-water-neighbour\.js/);
});
test('the verified map is untouched; independent File > PNG İndir has four background choices',()=>{
 const ui=read('src/ui/gis-workspace.js'),png=read('src/ui/gis-export.js');
 assert.match(ui,/function ensureQuickPngAction\(bar\)/);
 assert.match(ui,/quick\.textContent|el\("button","dg-png-btn ghost sm","🖼️ PNG İndir"\)/);
 assert.match(ui,/dgUxQuickPngDownload/);
 for(const name of ['vector','osm','sat','topo'])assert.ok(ui.includes('"'+name+'"'));
 assert.match(ui,/verified\.textContent="🖼️ Doğrulanmış Harita"/);
 assert.match(png,/async function renderVerified\(layers\)/);
 assert.match(png,/const baseChoice=\(\)=>read\("dgUxQuickPngBase"\)/);
 assert.match(png,/const button=event\.target\?\.closest\?\.\('button\[onclick\*="downloadParkImage"\]'\)/);
});

test('accepted mode and active boundary drawing never trigger inferred class writes',()=>{
 const accepted=fixture({state:{editing:false}});
 assert.deepEqual(Array.from(accepted.api.findPending()),[]);
 assert.equal(accepted.api.apply().count,0);
 assert.equal(accepted.stats().saves,0);
 const drawing=fixture({state:{draw:{ring:[],type:'water'}}});
 assert.deepEqual(Array.from(drawing.api.findPending()),[]);
 assert.equal(drawing.api.apply().count,0);
 assert.equal(drawing.stats().dirty,0);
});

test('the existing locked QC guard still refuses unassigned shoreline residuals',()=>{
 const source=read('src/ui/lc-sens.js');
 assert.match(source,/dgSensWaterBoundaryUnresolved\(\)>0\?/);
 assert.match(source,/sonuç kabul edilmedi/);
 assert.match(read('src/ui/gis-water-neighbour.js'),/if\(!known\.length\)return\[\]/);
});
