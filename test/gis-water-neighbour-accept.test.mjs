import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function fixture({accepted=false,busy=false,empty=false}={}){
 const oldSnapshot={schema:'dendrogeo-surface/2',acceptedAt:'2026-10-08',areas:{
  hard:65000,green:300000,water:123000,building:12000,bare:8000
 },evidence:['frozen-2026-10-08']};
 const manual={from:'green',to:'hard',method:'visual-cell',ts:'confirmed',source:'user'};
 const rec={
  id:'surface-goksu',owner:'field',parkId:25,draftDirty:!accepted,
  features:[{type:'water',method:'visual-boundary',osmId:'way/423602740'}],
  objectFeatures:[{type:'hard',method:'osm-boundary',osmId:'way/island-road'}],
  corrections:{'1:1':manual},
  acceptedResult:structuredClone(oldSnapshot),
  acceptedAreas:structuredClone(oldSnapshot.areas),
  acceptedAt:oldSnapshot.acceptedAt
 };
 if(!empty)for(let i=0;i<69;i++){
  const key=(10+Math.floor(i/10))+':'+(i%10);
  rec.corrections[key]={from:'water',to:i%4===0?'hard':'green',method:'visual-cell',
   source:'spatial-nearest-inference',evidence:{nearestCellKey:'1:1',distanceM:27}};
 }
 const state={record:rec,geometry:{'1:1':[{road:true}]},parkGeometry:{park:true},epsg:32636,
  busy,saving:false,exporting:false,rawView:false,draw:null,brush:null,
  editing:!accepted,epoch:3,visualVersion:8,partitionVersion:4,opacity:65};
 const reports=[],calls={dirty:0,refresh:0,update:0,save:0};
 const ctx={window:{DG_LC_SENS:{state}},document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},
  console,setTimeout,clearTimeout,Date,
  dgSensDirty(){calls.dirty++;state.visualVersion++;state.editing=true;rec.draftDirty=true;},
  dgSensRefreshLayer(){calls.refresh++;return Promise.resolve();},
  dgSensUpdateSummary(){calls.update++;},
  dgSensUpdateStatus(){reports.push(state.status);},
  dgSensSave(){calls.save++;return Promise.resolve(true);}
 };
 vm.runInNewContext(read('src/ui/gis-water-neighbour.js'),ctx);
 return{api:ctx.window.DG_GIS_WATER_NEIGHBOUR,state,rec,oldSnapshot,manual,calls,reports,ctx};
}

test('restores all 69 inferred Göksu water-land cells, preserving true manually reviewed island hard paths',()=>{
 const f=fixture(),backup=structuredClone(f.rec.objectFeatures);
 assert.equal(f.api.stats(f.rec).count,69);
 const actual=f.api.restore();
 assert.equal(actual.removed,69);
 assert.equal(Object.keys(f.rec.corrections).length,1);
 assert.deepEqual(f.rec.corrections['1:1'],f.manual);
 assert.deepEqual(f.rec.objectFeatures,backup,'locked OSM road footprints unchanged');
 assert.equal(f.rec.corrections['1:1'].to,'hard');
 assert.deepEqual(f.rec.acceptedResult,f.oldSnapshot,'the prior accepted scientific result remains exactly unchanged');
 assert.deepEqual(f.rec.acceptedAreas,f.oldSnapshot.areas);
 assert.equal(f.rec.acceptedAt,f.oldSnapshot.acceptedAt);
 assert.equal(f.state.editing,true);
 assert.equal(f.rec.draftDirty,true);
 assert.deepEqual(f.calls,{dirty:1,refresh:1,update:1,save:1});
 assert.match(f.state.status,/69/);
});
test('restoration is idempotent, does not guess any new raster classifications',()=>{
 const f=fixture();
 f.api.restore();
 assert.equal(f.api.restore().removed,0);
 assert.equal(f.api.stats(f.rec).count,0);
 assert.equal(f.calls.save,1);
 const g=fixture({empty:true});
 assert.equal(g.api.restore().removed,0);
 assert.equal(g.calls.dirty,0);
 assert.deepEqual(g.rec.corrections['1:1'],g.manual);
});
test('previously accepted inferred predictions reopen as preview without mutating approved snapshot',()=>{
 const f=fixture({accepted:true}),snap=structuredClone(f.rec.acceptedResult);
 assert.equal(f.state.editing,false);
 assert.equal(f.api.restore().removed,69);
 assert.equal(f.state.editing,true);
 assert.equal(f.rec.draftDirty,true);
 assert.deepEqual(f.rec.acceptedResult,snap);
});
test('operations during drawing, raw view, busy scan or saving never modify the review',()=>{
 for(const mode of [{busy:true},{rawView:true},{draw:{ring:[]}},{brush:{type:'hard'}},{saving:true}]){
  const f=fixture();Object.assign(f.state,mode);
  assert.equal(f.api.restore().removed,0);
  assert.equal(f.api.stats(f.rec).count,69);
  assert.equal(f.calls.save,0);
 }
});
test('only source-marked guesses are undone: never delete a manual class or changed source metadata',()=>{
 const f=fixture();
 f.rec.corrections['11:0']={from:'water',to:'hard',method:'visual-cell',
  source:'user-reviewed',ts:'manual-2026-10-08'};
 const before=structuredClone(f.rec.corrections['11:0']);
 assert.equal(f.api.restore().removed,68);
 assert.deepEqual(f.rec.corrections['11:0'],before);
 assert.deepEqual(f.rec.corrections['1:1'],f.manual);
});
test('no numeric raster/threshold/geometry fallback was introduced; old science accept gate still protects uncertain classes',()=>{
 const helper=read('src/ui/gis-water-neighbour.js');
 const core=read('src/ui/lc-sens.js');
 const lock=JSON.parse(read('docs/surface-engine-lock.json'));
 assert.equal(Object.keys(lock.locked_files).length,51);
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
 assert.ok(!lock.locked_files['src/ui/gis-water-neighbour.js']);
 assert.match(helper,/decision\.source===SOURCE/);
 assert.doesNotMatch(helper,/dgSensAccept\s*=|dgSensEffective\s*=|acceptedResult\s*=|acceptedAreas\s*=|\.to\s*=\s*['"]green/);
 assert.doesNotMatch(helper,/spatial-nearest-inference-not-satellite|function propose\(/);
 assert.match(core,/dgSensWaterBoundaryUnresolved\(\)>0\?/);
 assert.match(core,/sonuç kabul edilmedi/);
 assert.match(read('sw.js'),/\/src\/ui\/gis-water-neighbour\.js/);
});
test('Doğrulanmış Harita and all four PNG basemaps stay available while pool is only shown as Su',()=>{
 const ui=read('src/ui/gis-workspace.js'),png=read('src/ui/gis-export.js');
 assert.match(ui,/function keepSingleFileMenu\(bar\)/);
 assert.match(ui,/core\.querySelector\("#dgUxQuickPngDownload"\)\?\.remove\(\)/);
 assert.match(ui,/verified\.textContent="🖼️ Doğrulanmış Harita"/);
 for(const cls of ['vector','osm','sat','topo'])assert.ok(read('src/ui/park-panel.js').includes('value="'+cls+'"'));
 assert.match(png,/async function renderVerified\(layers\)/);
 assert.match(ui,/item\.cls==="pool"\?"#3b82f6"/);
 assert.match(ui,/pool=Number\(areas\.pool\|\|0\)/);
 assert.match(ui,/if\(pool\)pool\.remove\(\)/);
 assert.match(png,/type==="pool"\?"#3b82f6"/);
 assert.doesNotMatch(ui,/item\.cls==="other"\?paint\[i\]/);
});

test('island road classification comes only from the frozen engine and verified geometry, never a sidecar vote',()=>{
 const science=read('src/ui/lc-sens.js');
 const workspace=read('src/ui/gis-workspace.js');
 const ordinaryPng=read('src/ui/gis-export.js');
 assert.match(science,/fillColor:DG_SENS_COLORS\[cls\]\|\|DG_SENS_COLORS\.other/);
 assert.match(science,/DG_SENS\.displayPaths\.push\(\{poly,cls\}\)/);
 assert.match(workspace,/for\(const item of paths\)/);
 assert.doesNotMatch(workspace,/const paint=typeof nearest/);
 assert.doesNotMatch(ordinaryPng,/const nearest=nearestPresentationTypes\(sens\?\.displayFeatures\)/);
 assert.match(ordinaryPng,/const type=item\.cls/);
 assert.match(science,/const DG_SENS_COLORS=\{green:"#22c55e",water:"#3b82f6",hard:"#64748b"/);
});

test('the old File menu alone hosts original PNG export card; no second File menu, PNG button or base choice',()=>{
 const ui=read('src/ui/gis-workspace.js');
 const png=read('src/ui/gis-export.js');
 assert.doesNotMatch(ui,/function makeOutput\(/);
 assert.doesNotMatch(ui,/document\.createElement\("details"\)/);
 assert.doesNotMatch(ui,/ensureQuickPngAction\(/);
 assert.match(ui,/const menu=coreFile/);
 assert.match(ui,/if\(exportCard\.parentElement!==panel\)panel\.append\(exportCard\)/);
 assert.match(ui,/const legacy=exportCard\.querySelector\('button\[onclick\*="downloadParkImage"\]'\)/);
 assert.match(png,/const baseChoice=\(\)=>read\("pngBg"\)\?\.value\|\|"vector"/);
 assert.match(read('src/ui/park-panel.js'),/id="pngBg"/);
 assert.match(read('src/ui/lc-sens.js'),/onclick="dgSensExportPng\(\)"/);
});

test('uncertain shoreline pixels are retested using only Sentinel-2 validated evidence, not nearest-green guessing',async()=>{
 const script=read('src/ui/gis-water-neighbour.js');
 assert.match(script,/window\.DG_LC_VALIDATE\.spectralLandPredict\(e,/);
 assert.match(script,/window\.DG_LC_S2\.profile\(queue\.map\(p=>p\.cell\)/);
 assert.match(script,/const LAND=new Set\(\["green","hard","bare"\]\)/);
 assert.doesNotMatch(script,/function propose\(|nearestCellKey|\.corrections\[key\]=/);
 assert.doesNotMatch(script,/rec\.acceptedResult\s*=|rec\.acceptedAreas\s*=|dgSensAccept\s*=/);
});
