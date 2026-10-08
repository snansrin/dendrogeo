import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import polygonClipping from 'polygon-clipping';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function harness(){
 const logs=[],posts=[],report={dataset:{},style:{display:'block'},innerHTML:''};
 const btn={disabled:false,textContent:'🌿 Yüzey Örtüsü Analizi'};
 const status={dataset:{},setAttribute(){},textContent:''};
 const action={append(n){logs.push('progress-mounted');}};
 const elements={landCoverBtn:btn,landCoverReport:report,parkSurfaceAction:action,
  dgUnifiedParkAnalysisStatus:status};
 const document={readyState:'loading',addEventListener(){},
  getElementById:id=>elements[id]||null,
  createElement:tag=>({id:'',dataset:{},setAttribute(){},className:'',textContent:''})};
 const water={type:'water',method:'osm-boundary',osmId:'way/15',
  geometry:{type:'MultiPolygon',coordinates:[]}};
 const existing={type:'building',osmId:'way/7',
  geometry:{type:'MultiPolygon',coordinates:[]}};
 const rec={id:'surface-goksu',parkId:25,objectFeatures:[water,existing],
  acceptedResult:{id:'frozen'},acceptedAreas:{water:125000}};
 const state={record:rec,geometry:{},parkGeometry:[[[[0,0],[1000,0],[1000,1000],[0,1000],[0,0]]]],
  epsg:32636,epoch:2,partitionVersion:3,rawView:false,editing:true,
  busy:false,saving:false,draw:null,brush:null};
 const elementsOsm=[
  {type:'way',id:1,tags:{highway:'footway',surface:'asphalt',width:'2.6'},
   geometry:[{lon:32.65,lat:39.95},{lon:32.6501,lat:39.9502}]},
  {type:'way',id:2,tags:{highway:'footway',surface:'ground'},
   geometry:[{lon:32.651,lat:39.95},{lon:32.652,lat:39.95}]},
  {type:'way',id:3,tags:{highway:'service'},
   geometry:[{lon:32.649,lat:39.949},{lon:32.6492,lat:39.9492}]},
  {type:'way',id:4,tags:{highway:'path',surface:'mud'},
   geometry:[{lon:32.649,lat:39.948},{lon:32.6493,lat:39.948}]},
  {type:'way',id:5,tags:{highway:'footway'},
   geometry:[{lon:32.65,lat:39.949},{lon:32.6501,lat:39.9491}]}];
 const parkPoly=[[[39.95,32.65],[39.96,32.65],[39.96,32.66],[39.95,32.66]]];
 const global={
  window:{DG_LC_SENS:{state},DG_SURFACE_OSM:{boundary:JSON.stringify(parkPoly),elements:elementsOsm},
   DG_LANDCOVER:{getLast:()=>({result:{cells:[{key:'a'}]}})},
   DG_GIS_WATER_NEIGHBOUR:{missingParts:()=>[],recheckMissing:async()=>({remaining:0,resolved:0})},
   runLandCoverAnalysis:async()=>{posts.push('baseline');}},
  PARK_POLY:parkPoly,document,Date,setTimeout,clearTimeout,console,
  dgSurfaceProject:(pts)=>pts.map(p=>[p[0]*10,p[1]*10]),
  dgSurfaceClip:(operation,...polys)=>{
   logs.push(operation);
   if(operation==='union')return polys.flatMap(p=>p);
   return polys[0]||[];
  },
  dgSurfaceFeatureGeometry:feature=>feature?.geometry?.coordinates||[],
  dgSurfaceArea:()=>500,
  dgSurfaceUnproject:p=>p,
  dgSensDirty:()=>{logs.push('dirty');state.visualVersion=(state.visualVersion||0)+1;state.editing=true;rec.draftDirty=true;},
  dgSensRepartition:async()=>{logs.push('partition');return true;},
  dgSensSave:async()=>{logs.push('draftSaved');return true;},
  dgSensScan:async()=>{posts.push('scan');return true;},
 };
 vm.runInNewContext(load('src/ui/gis-analysis-flow.js'),global);
 return{api:global.window.DG_GIS_PARK_ANALYSIS,global,logs,posts,btn,report,status,state,rec,osm:elementsOsm,parkPoly};
}
test('the same OSM highway ways used by grid generate hard strips only for built paths',()=>{
 const h=harness();
 const list=h.api.candidateRoads(h.osm);
 assert.deepEqual(Array.from(list.map(x=>x.id)),['way/1','way/3','way/5']);
 assert.ok(list.every(x=>x.points.length>=2));
 assert.equal(list[0].halfWidth,1.3);
 assert.equal(list[0].material,'explicit-paved');
 assert.equal(list[1].material,'mapped-road-geometry');
 assert.equal(h.api.roadEvidence({highway:'footway',surface:'dirt'}),null);
 assert.equal(h.api.roadEvidence({highway:'path',surface:'ground'}),null);
 assert.equal(h.api.roadEvidence({highway:'track',surface:'mud'}),null);
 assert.equal(h.api.roadEvidence({highway:'footway',surface:'gravel'}),null);
});
test('road footprints use real path buffers and provenance, never full 100m² raster-cell relabeling',()=>{
 const h=harness();
 const f=h.api.hardRoadDrafts(h.osm,h.rec.objectFeatures,32636,h.state.parkGeometry);
 assert.equal(f.length,3);
 assert.ok(f.every(x=>x.type==='hard'&&x.method==='osm-boundary'&&x.source==='osm-grid-road-exact-footprint'));
 assert.ok(f.every(x=>x.geometry.type==='MultiPolygon'&&x.geometry.coordinates.length>0));
 assert.ok(f.every(x=>!Object.hasOwn(x,'classKey')&&!Object.hasOwn(x,'to')));
 assert.ok(h.logs.includes('union')&&h.logs.includes('intersection')&&h.logs.includes('difference'));
});
test('hard-road patches do not overwrite accepted scientific snapshot, water or building and are idempotent',async()=>{
 const h=harness(),oldAccepted=structuredClone(h.rec.acceptedResult),oldWater=h.rec.objectFeatures[0],oldBuilding=h.rec.objectFeatures[1];
 const first=await h.api.applyGridRoads();
 assert.equal(first.count,3);
 assert.equal(first.materialConfirmed,1);
 assert.equal(first.provisional,2);
 assert.equal(h.rec.objectFeatures[0],oldWater);
 assert.equal(h.rec.objectFeatures.at(-1),oldBuilding);
 assert.deepEqual(h.rec.acceptedResult,oldAccepted);
 assert.deepEqual(h.rec.acceptedAreas,{water:125000});
 assert.ok(h.logs.includes('partition')&&h.logs.includes('draftSaved'));
 const next=await h.api.applyGridRoads();
 assert.equal(next.count,0,'no duplicate OSM ways or duplicate budget');
 assert.equal(h.rec.objectFeatures.length,5);
});
test('Park Analizi replaces two sequential user operations with one; only reviewed card appears',async()=>{
 const h=harness();
 const result=await h.api.run();
 assert.equal(result,true);
 assert.deepEqual(h.posts,['baseline','scan']);
 assert.equal(h.report.dataset.dgUnifiedPhase,'ready');
 assert.equal(h.btn.textContent,'🛰 Park Analizi');
 assert.equal(h.btn.disabled,false);
 assert.match(h.status.textContent,/OSM yol izi: 3/);
 assert.equal(h.state.record.objectFeatures.length,5);
});
test('a failed initial raster must not be shown as a completed review or accepted automatically',async()=>{
 const h=harness();
 h.global.window.runLandCoverAnalysis=async()=>{throw Error('raster unavailable');};
 assert.equal(await h.api.run(),false);
 assert.equal(h.report.dataset.dgUnifiedPhase,'failed');
 assert.match(h.status.textContent,/raster unavailable/);
 assert.ok(!h.logs.includes('draftSaved'));
});
test('existing scanned map is never treated as scientific evidence of ALL 62 resolved shoreline pixels',async()=>{
 const h=harness();h.global.window.DG_GIS_WATER_NEIGHBOUR={
  missingParts:()=>Array(62).fill('unresolved'),recheckMissing:async()=>({remaining:62,resolved:0})};
 assert.equal(await h.api.run(),true);
 assert.match(h.status.textContent,/62 hücre bilimsel doğrulama bekliyor/);
 assert.equal(h.status.dataset.phase,'warning');
 assert.equal(h.report.dataset.dgUnifiedPhase,'ready','review preview remains visible while acceptance is still guarded');
});
test('locked engine untouched, old scientific WC prerequisite is retained but duplicate report hidden',()=>{
 const lock=JSON.parse(load('docs/surface-engine-lock.json'));
 assert.equal(Object.keys(lock.locked_files).length,51);
 for(const p of ['src/ui/park-export.js','src/ui/lc-sens.js','src/services/lc-review.js'])assert.ok(lock.locked_files[p]);
 const flow=load('src/ui/gis-analysis-flow.js');
 const css=load('css/gis-workspace.css');
 const boot=load('partials/boot.html');
 const sw=load('sw.js');
 assert.match(flow,/await window\.runLandCoverAnalysis\(\)/);
 assert.match(flow,/const scanned=await dgSensScan\(\)/);
 assert.match(flow,/const roads=await applyGridRoads\(\)/);
 assert.match(flow,/reportVisibility\("pending"\)/);
 assert.match(flow,/reportVisibility\("ready"\)/);
 assert.match(css,/#v-map #landCoverReport\[data-dg-unified-phase="pending"\]/);
 assert.match(boot,/src\/ui\/gis-analysis-flow\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/gis-analysis-flow\.js/);
 assert.doesNotMatch(flow,/DG_LC_SENS\.state\.acceptedResult\s*=|dgSensWaterBoundaryUnresolved\s*=/);
});

test('real polygon clipping: road strip is kept inside park and cannot cover scientific water/buildings',()=>{
 const ctx=vm.createContext({
  window:{polygonClipping},document:{readyState:'loading',addEventListener(){}},
  console,setTimeout,clearTimeout,Math,Date
 });
 for(const path of ['src/services/lc-geo.js','src/services/lc-review.js','src/ui/gis-analysis-flow.js'])
  vm.runInContext(load(path),ctx);
 const ring=[[39.9498,32.6498],[39.9498,32.6512],[39.9504,32.6512],[39.9504,32.6498]];
 ctx.ring=ring;
 const park=vm.runInContext('dgSurfacePark([ring],[],32636)',ctx);
 const polygon=(west,south,east,north)=>[[[
  [west,south],[east,south],[east,north],[west,north],[west,south]
 ]]];
 const water={type:'water',geometry:{type:'MultiPolygon',
  coordinates:polygon(32.6498,39.9498,32.6501,39.9504)}};
 const building={type:'building',geometry:{type:'MultiPolygon',
  coordinates:polygon(32.65064,39.9498,32.6508,39.9503)}};
 const road={type:'way',id:807,tags:{highway:'footway',surface:'asphalt',width:'2.5'},
  geometry:[{lon:32.65,lat:39.9501},{lon:32.651,lat:39.9501}]};
 const features=ctx.window.DG_GIS_PARK_ANALYSIS.hardRoadDrafts(
  [road],[water,building],32636,park);
 assert.equal(features.length,1);
 assert.equal(features[0].osmId,'way/807');
 assert.equal(features[0].roadEvidence,'explicit-paved');
 ctx.road=features[0];ctx.water=water;ctx.building=building;
 const area=vm.runInContext('dgSurfaceArea(dgSurfaceFeatureGeometry(road,32636))',ctx);
 const overlapWater=vm.runInContext('dgSurfaceArea(dgSurfaceClip("intersection",dgSurfaceFeatureGeometry(road,32636),dgSurfaceFeatureGeometry(water,32636)))',ctx);
 const overlapBuilding=vm.runInContext('dgSurfaceArea(dgSurfaceClip("intersection",dgSurfaceFeatureGeometry(road,32636),dgSurfaceFeatureGeometry(building,32636)))',ctx);
 assert.ok(area>0&&area<500,'real vector path area is not an entire 10m raster cell');
 assert.ok(overlapWater<0.01,'real mapped lake is never relabeled hard');
 assert.ok(overlapBuilding<0.01,'real mapped building is never relabeled hard');
});
