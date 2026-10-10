import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/application/parks/fetch-detailed-coverage.js',import.meta.url),'utf8');

function create(getParkPolygon,queryOsm){
  const context=vm.createContext({window:{}});
  vm.runInContext(source,context);
  return context.window.DG_PARK_COVERAGE_FETCH_APPLICATION.create({getParkPolygon,queryOsm});
}

test('detailed coverage fetch uses one combined OSM query with the padded park bounds',async()=>{
  const park=[[[39,32],[39,33],[40,33]]];
  const calls=[];
  const fetch=create(()=>park,async(...args)=>{calls.push(args);return{elements:[]};});
  const result=await fetch();

  assert.equal(calls.length,1);
  assert.equal(calls[0][1],'yüzey+su');
  assert.ok(calls[0][0].startsWith('[out:json][timeout:90];('));
  for(const clause of ['["natural"="water"]','["building:part"]','["highway"]','["area:highway"]','["amenity"~"parking','["leisure"~"pitch|track|playground"]','["surface"~"asphalt','["man_made"~"pier|bridge"]']){
    assert.ok(calls[0][0].includes(clause),`missing query clause ${clause}`);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(result.bbox)),{minLat:39,minLon:32,maxLat:40,maxLon:33});
  assert.equal(calls[0][0].includes('(38.9995,31.9995,40.0005,33.0005)'),true);
  assert.equal(result.boundary,JSON.stringify(park));
  assert.equal(result.stale,false);
});

test('late coverage data is marked stale when park selection changes during the request',async()=>{
  let selected=[[[39,32],[39,33],[40,33]]];
  let release;
  const fetch=create(()=>selected,()=>new Promise(resolve=>{release=resolve;}));
  const pending=fetch();
  selected=[[[40,33],[40,34],[41,34]]];
  release({elements:[]});
  const result=await pending;
  assert.equal(result.stale,true);
  assert.equal(result.json,null);
});

test('coverage fetch skips network access when there is no selected park',async()=>{
  let calls=0;
  const fetch=create(()=>null,async()=>{calls++;return{elements:[]};});
  assert.equal(await fetch(),null);
  assert.equal(calls,0);
});
