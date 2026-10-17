import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const MODULES=[
  'src/application/parks/share-detailed-coverage-request.js',
  'src/application/parks/commit-park-coverage-snapshot.js',
  'src/application/parks/collect-park-coverage-elements.js',
  'src/domain/parks/filter-park-coverage-to-boundary.js',
  'src/ui/park-water-layer-renderer.js',
];

test('coverage request is shared per boundary and cleanup keeps a newer request safe',async()=>{
  const context=vm.createContext({window:null,Promise});context.window=context;
  vm.runInContext(read(MODULES[0]),context);
  let resolve,runCount=0,pending=null;
  const options={getPending:()=>pending,setPending:value=>{pending=value;},clearPending:()=>{pending=null;},run:()=>{runCount++;return new Promise(done=>{resolve=done;});}};
  const first=context.DG_SHARE_DETAILED_COVERAGE_REQUEST.request('a',options);
  assert.equal(context.DG_SHARE_DETAILED_COVERAGE_REQUEST.request('a',options),first);
  assert.equal(runCount,1);
  resolve(true);assert.equal(await first,true);
  await Promise.resolve();assert.equal(pending,null);
});

test('boundary reset, padded snapshot, collection, and park clipping preserve geometry shape',()=>{
  const context=vm.createContext({window:null});context.window=context;
  for(const path of MODULES.slice(1,4))vm.runInContext(read(path),context);
  let coverage={boundary:'old'},clears=0;
  assert.equal(context.DG_COMMIT_PARK_COVERAGE_SNAPSHOT.clearForChangedBoundary('old',{getCoverage:()=>coverage,clearCoverage:()=>{coverage=null;},clearGeometry:()=>{clears++;}}),false);
  assert.equal(context.DG_COMMIT_PARK_COVERAGE_SNAPSHOT.clearForChangedBoundary('new',{getCoverage:()=>coverage,clearCoverage:()=>{coverage=null;},clearGeometry:()=>{clears++;}}),true);
  assert.equal(clears,1);
  const snapshot=context.DG_COMMIT_PARK_COVERAGE_SNAPSHOT.commit({elements:null,bbox:{minLat:1,minLon:2,maxLat:3,maxLon:4},pad:.5,boundary:'new',fetchedAt:'then'});
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)),{elements:[],bbox:{minLat:.5,minLon:1.5,maxLat:3.5,maxLon:4.5},boundary:'new',fetchedAt:'then',complete:true});
  const waterRing=[[1,2],[1,3],[2,3]];const waterLine=[[1,2],[2,3]];const rings=[];const lines=[];let pedestrian=0,impervious=0;
  context.DG_COLLECT_PARK_COVERAGE_ELEMENTS.collect([
    {element:{type:'relation'},water:true,skip:false},
    {element:{type:'way',geometry:[{lat:1,lon:2},{lat:2,lon:3}]},water:true},
    {element:{type:'way',tags:{highway:'footway'}},pedestrian:true,impervious:true},
  ],{extractRings:()=>({outer:[waterRing]}),isClosedLine:()=>false,addWaterRing:ring=>rings.push(ring),addWaterLine:line=>lines.push(line),collectPedestrianGridBlocker:()=>pedestrian++,collectImperviousGeometry:()=>impervious++});
  assert.equal(rings.length,1);assert.equal(lines.length,1);assert.equal(pedestrian,1);assert.equal(impervious,1);
  const result=context.DG_FILTER_PARK_COVERAGE_TO_BOUNDARY.filter({waterRings:[waterRing],waterLines:[waterLine],imperviousRings:[waterRing],imperviousLines:[{pts:waterLine}],gridBlockLines:[waterLine],park:'park',bounds:{},clearance:7,isRingTouching:()=>true,lineTouches:(line)=>line.length===2});
  assert.equal(result.waterRings.length,1);assert.equal(result.gridBlockLines[0].w,7);
});

test('locked park-query service delegates concurrent coverage calls to the modules',async()=>{
  let resolve,calls=0;
  const context=vm.createContext({
    window:null,OVERPASS_HEALTH:new Map(),Map,Date,Promise,URLSearchParams,console:{warn(){},log(){}},PARK_POLY:[[[39,32],[39,33],[40,33]]],PARK_HOLES:[],
    IMP_RINGS:[],IMP_LINES:[],GRID_BLOCK_LINES:[],WATER_RINGS:[],WATER_LINES:[],IMP_CLEARANCE_M:5,
    overpassRequest:()=>{calls++;return new Promise(done=>{resolve=done;});},dgParkBoundaryFallback:async()=>[],extractRings:()=>null,
    polyArea:()=>1,pointInPark:()=>true,ringTouchesPark:()=>true,lineTouchesPark:()=>true,isWater:()=>false,isImpervious:()=>false,
    collectPedestrianGridBlocker(){},collectImperviousGeometry(){},isClosedLine:()=>false,
  });
  context.window=context;
  for(const path of MODULES)vm.runInContext(read(path),context,{filename:path});
  for(const path of ['src/domain/parks/build-osm-surface-query.js','src/application/parks/find-park-candidates.js','src/application/parks/fetch-detailed-coverage.js','src/application/parks/classify-coverage-elements.js','src/application/parks/find-nominatim-boundary.js','src/adapters/parks/nominatim-client.js'])vm.runInContext(read(path),context,{filename:path});
  vm.runInContext(read('src/application/parks/recover-park-boundary.js'),context,{filename:'src/application/parks/recover-park-boundary.js'});
  vm.runInContext(read('src/domain/parks/decode-osm-map-geometry.js'),context,{filename:'src/domain/parks/decode-osm-map-geometry.js'});
  vm.runInContext(read('src/adapters/parks/load-osm-map-coverage.js'),context,{filename:'src/adapters/parks/load-osm-map-coverage.js'});
  vm.runInContext(read('src/services/park-query.js'),context,{filename:'src/services/park-query.js'});
  const first=vm.runInContext('queryDetailedCoverage()',context);
  const second=vm.runInContext('queryDetailedCoverage()',context);
  assert.equal(first,second);assert.equal(calls,1);
  resolve({elements:[]});assert.equal(await first,true);
  assert.equal(context.DG_SURFACE_OSM.boundary,JSON.stringify(context.PARK_POLY));
  assert.equal(context.DG_SURFACE_OSM.bbox.minLat,38.9995);
});
