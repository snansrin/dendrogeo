import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/application/parks/find-nominatim-boundary.js',import.meta.url),'utf8');
const polygon={osm_type:'way',osm_id:123,name:'Test Park',geojson:{type:'Polygon',coordinates:[[[32,39],[32.01,39],[32.01,39.01],[32,39.01],[32,39]],[[32.004,39.004],[32.006,39.004],[32.006,39.006],[32.004,39.006],[32.004,39.004]]]}};
const candidate={osm_type:'way',osm_id:123,category:'leisure',type:'park',boundingbox:['39','39.01','32','32.01']};

function create(options={}){
  const context=vm.createContext({window:{}});
  vm.runInContext(source,context);
  return context.window.DG_NOMINATIM_BOUNDARY_APPLICATION.create({
    cache:options.cache||new Map(),
    fetchNominatim:options.fetchNominatim||(async()=>[]),
    areaOf:options.areaOf||(()=>1),
    containsPoint:options.containsPoint||(()=>true),
    now:options.now||(()=>1000)
  });
}

test('GeoJSON parks become verified lat-lon rings while retaining holes',()=>{
  const app=create();
  const result=app.geojsonCandidate(polygon);
  assert.equal(result.boundaryProvider,'nominatim');
  assert.equal(result.rings.outer[0][0][0],39);
  assert.equal(result.rings.inner.length,1);
  assert.equal(app.geojsonCandidate({...polygon,geojson:{type:'Point',coordinates:[32,39]}}),null);
});

test('search bounds filter candidates, polygon containment verifies results, and verified parks are cached',async()=>{
  const calls=[];
  let now=1000;
  const app=create({
    now:()=>now,
    areaOf:rings=>rings.inner.length?2:1,
    containsPoint:(lat,_lon,rings)=>lat>39&&lat<40&&rings.outer[0][0][0]===39,
    fetchNominatim:async request=>{
      calls.push(request);
      return request.path==='search'?[candidate,{...candidate,osm_id:456,boundingbox:['39.1','39.2','32.1','32.2']}]:[{...polygon,osm_id:456},polygon];
    }
  });

  const found=await app.findBoundary(39.002,32.002,1200);
  assert.deepEqual(JSON.parse(JSON.stringify(found.map(park=>park.id))),[123]);
  assert.equal(calls.length,2);
  assert.equal(calls[0].query.bounded,'1');
  assert.equal(calls[1].query.osm_ids,'W123');
  assert.ok(calls[0].query.viewbox);

  await app.findBoundary(39.002,32.002,1200);
  assert.equal(calls.length,2);

  now+=600001;
  await app.findBoundary(39.002,32.002,1200);
  assert.equal(calls.length,4);
});

test('search candidates with only an extent outside the selected point are not looked up',async()=>{
  let calls=0;
  const app=create({fetchNominatim:async()=>{calls++;return[{...candidate,boundingbox:['39.1','39.2','32.1','32.2']}];}});
  assert.equal((await app.findBoundary(39.002,32.002,1200)).length,0);
  assert.equal(calls,1);
});
