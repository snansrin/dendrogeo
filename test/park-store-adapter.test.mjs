import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/adapters/parks/park-store.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_STORE_ADAPTER.create;

function mockClient(response){
  const calls=[];
  const query={
    select(value){calls.push(['select',value]);return this;},
    eq(key,value){calls.push(['eq',key,value]);return this;},
    gte(key,value){calls.push(['gte',key,value]);return this;},
    lte(key,value){calls.push(['lte',key,value]);return this;},
    limit(value){calls.push(['limit',value]);return Promise.resolve(response);},
    insert(row){calls.push(['insert',row]);return this;},
    async single(){calls.push(['single']);return response;}
  };
  return{calls,client:{from(table){calls.push(['from',table]);return query;}}};
}

test('park store selects by canonical OSM key and absorbs lookup failures',async()=>{
  const row={id:7,osm_key:'way/42'},mock=mockClient({data:[row],error:null});
  const store=create({client:mock.client,normalizeLoose:s=>String(s).toLowerCase(),distance:()=>0});
  assert.equal(await store.selectByKey('way/42'),row);
  assert.deepEqual(mock.calls.map(x=>x[0]),['from','select','eq','limit']);
  const failed=create({client:{from(){throw Error('offline');}},normalizeLoose:String,distance:()=>0});
  assert.equal(await failed.selectByKey('way/42'),null);
});

test('near lookup uses bounded coordinates, loose names and nearest matching row',async()=>{
  const near={id:7,name:'Göksu Parkı',centroid_lat:40.0005,centroid_lon:29};
  const farther={id:8,name:'Göksu Park',centroid_lat:40.003,centroid_lon:29};
  const wrong={id:9,name:'Eymir Gölü',centroid_lat:40.0001,centroid_lon:29};
  const mock=mockClient({data:[farther,wrong,near],error:null});
  const distance=(a,b,c,d)=>Math.hypot((a-c)*111000,(b-d)*111000);
  const store=create({client:mock.client,normalizeLoose:s=>String(s).replace(/ parkı?$/i,''),distance});
  assert.equal(await store.selectNear('Göksu Park',40,29,1000),near);
  assert.ok(mock.calls.some(x=>x[0]==='gte'&&x[1]==='centroid_lat'));
  assert.equal(await store.selectNear('Göksu Park',40,29,20),null);
  assert.equal(await store.selectNear('Göksu Park',NaN,29,1000),null);
});

test('park store inserts a row without changing the response',async()=>{
  const response={data:{id:9},error:null},mock=mockClient(response);
  const store=create({client:mock.client,normalizeLoose:String,distance:()=>0});
  const row={osm_key:'manual/park/40/29'};
  assert.equal(await store.insert(row),response);
  assert.equal(mock.calls.find(x=>x[0]==='insert')[1],row);
});
