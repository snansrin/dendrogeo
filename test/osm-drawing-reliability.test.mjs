import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function environment(paths,extra={}){const c=vm.createContext({window:null,Map,Date,Promise,AbortController,setTimeout,clearTimeout,console:{log(){},warn(){}},...extra});c.window=c;for(const p of paths)vm.runInContext(read(p),c);return c;}
test('all native park dialogs use the browser window as receiver',()=>{
 const c=environment(['src/ui/park-admin-mutation.js']);let calls=0;
 const ports={translate:s=>s,translateFormat:s=>s,prompt:function(){assert.equal(this,vm.runInContext("window",c));calls++;return 'name';},confirm:function(){assert.equal(this,vm.runInContext("window",c));calls++;return true;}};
 const park={id:1,name:'Park'};assert.equal(c.DG_PARK_ADMIN_MUTATION_UI.promptRename(park,ports),'name');assert.equal(c.DG_PARK_ADMIN_MUTATION_UI.confirmDelete(park,ports),true);assert.equal(c.DG_PARK_ADMIN_MUTATION_UI.confirmMerge(park,park,ports),true);assert.equal(calls,3);
});
test('provider recovery reaches an independent backend after a primary 504 and a short park abort does not poison surface requests',async()=>{
 const urls=[];let aborted=false;
 const c=environment(['src/adapters/parks/post-overpass-query.js','src/adapters/parks/overpass-mirror-health.js','src/domain/parks/select-overpass-mirrors.js','src/domain/parks/overpass-request-budget.js','src/services/osm-client.js'],{fetch:async url=>{urls.push(url);if(!aborted){aborted=true;const e=Error('park deadline');e.name='AbortError';throw e;}return {ok:true,json:async()=>({elements:[{type:'way',id:1}]})};}});
 assert.ok(await c.overpassRequest('park-query','park'));assert.equal(vm.runInContext('OVERPASS_HEALTH.get(OVERPASS_URLS[0])',c),undefined);
 assert.ok(await c.overpassRequest('surface-query','yüzey+su'));assert.ok(urls.some(url=>url.includes('maps.mail.ru')));
 const d=environment(['src/adapters/parks/post-overpass-query.js','src/adapters/parks/overpass-mirror-health.js','src/domain/parks/select-overpass-mirrors.js','src/domain/parks/overpass-request-budget.js','src/services/osm-client.js'],{fetch:async url=>url.includes('overpass-api.de')?{ok:false,status:504}:{ok:true,json:async()=>({elements:[]})}});
 assert.ok(await d.overpassRequest('surface-query','yüzey+su'));assert.ok(vm.runInContext('OVERPASS_HEALTH.get(OVERPASS_URLS[0]).badUntil>Date.now()',d));
});
test('metric rectangle and 96-vertex circle preserve deterministic area and valid coordinates',()=>{
 const c=environment(['src/domain/surface/build-boundary-shape-ring.js']),build=c.DG_BUILD_BOUNDARY_SHAPE_RING.build;
 const ports={first:[10,20],last:[20,30],forward:(lat,lon)=>({x:lon,y:lat}),inverse:(x,y)=>({lon:x,lat:y})};
 const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
 assert.equal(area(build({...ports,shape:'rectangle'})),100);const circle=build({...ports,shape:'circle'});assert.equal(circle.length,96);assert.ok(Math.abs(area(circle)/(Math.PI*200)-1)<.001);assert.equal(build({...ports,shape:'circle',last:ports.first}).length,0);
});
test('applying a boundary keeps the session open, resets only after success, and copies the persistent ring',async()=>{
 const c=environment(['src/application/surface/finish-surface-boundary-drawing.js']),record={features:[]},draw={type:'hard',ring:[[0,0],[1,0],[1,1]]};let reset=0,cancel=0;
 const result=await c.DG_FINISH_SURFACE_BOUNDARY_DRAWING.finish({draw,prepare:()=>({kind:'ready'}),record:()=>record,timestamp:()=> 'now',markDirty(){},cancel:()=>cancel++,continueDrawing:()=>{reset++;draw.ring=[];},renderTools(){},repartition:async()=>true,save:async()=>{},needsWaterScan:()=>false});
 assert.equal(result,true);assert.equal(reset,1);assert.equal(cancel,0);assert.equal(record.features[0].ring.length,3);assert.equal(draw.ring.length,0);
});
test('drawing modules are lazy and offline-ready without changing the initial package footprint',()=>{
 for(const p of ['src/domain/surface/build-boundary-shape-ring.js','src/ui/surface-drawing-cursor-menu.js','src/adapters/surface/surface-drawing-workspace.js']){assert.ok(read('src/utils/lazylibs.js').includes(p));assert.ok(read('sw.js').includes(p));assert.ok(!read('partials/head.html').includes(p));}
 assert.ok(read('sw.js').includes("Service Worker '+CACHE_VERSION"));assert.ok(read('partials/head.html').includes('src/adapters/parks/load-osm-map-coverage.js'));
});

test('native OSM geometry preserves relation roles and ordered nodes and rejects missing evidence',()=>{
 const c=environment(['src/domain/parks/decode-osm-map-geometry.js','src/domain/parks/build-osm-surface-query.js']);const elements=[{type:'node',id:1,lat:39,lon:32},{type:'node',id:2,lat:40,lon:33},{type:'way',id:7,nodes:[2,1]},{type:'relation',id:8,tags:{natural:'water',type:'multipolygon'},members:[{type:'way',ref:7,role:'inner'}]}];
 const result=c.DG_DECODE_OSM_MAP_GEOMETRY.decode({elements,candidates:['relation/8']});assert.equal(result[0].members[0].role,'inner');assert.equal(result[0].members[0].geometry[0].lat,40);assert.throws(()=>c.DG_DECODE_OSM_MAP_GEOMETRY.decode({elements:elements.filter(e=>e.id!==1),candidates:['relation/8']}),/eksik/);
 for(const [type,tags] of [['way',{highway:'footway'}],['relation',{building:'yes'}],['node',{amenity:'fountain'}]])assert.equal(c.DG_OSM_SURFACE_QUERY.relevant({type,tags}),true);
 assert.equal(c.DG_OSM_SURFACE_QUERY.relevant({type:'node',tags:{highway:'bus_stop'}}),false);
});
test('quarantined Overpass recovers via native coverage first and never retries a failed fallback twice',async()=>{
 const c=environment(['src/domain/parks/build-osm-surface-query.js','src/application/parks/fetch-detailed-coverage.js']),park=[[[39,32],[39,32.001],[39.001,32.001]]];let native=0,overpass=0;
 const read=c.DG_PARK_COVERAGE_FETCH_APPLICATION.create({getParkPolygon:()=>park,queryOsm:async()=>{overpass++;return null},preferFallback:()=>true,queryFallback:async()=>{native++;return{elements:[],complete:true,source:'osm-api'}}});assert.ok((await read()).json);assert.equal(native,1);assert.equal(overpass,0);await read();assert.equal(native,1);
 const fail=c.DG_PARK_COVERAGE_FETCH_APPLICATION.create({getParkPolygon:()=>park,queryOsm:async()=>null,preferFallback:()=>true,queryFallback:async()=>{native++;return null}});assert.equal((await fail()).json,null);assert.equal(native,2);
});
