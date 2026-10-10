import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/parks/osm-rings.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const {extractRings,joinWaysToRings}=context.window.DG_PARK_OSM_RINGS;
const plain=value=>JSON.parse(JSON.stringify(value));

test('way extraction filters invalid coordinates and closes valid [LAT,LON] rings',()=>{
  const result=extractRings({type:'way',geometry:[
    {lat:'39',lon:'32'},{lat:'39',lon:'33'},{lat:'40',lon:'33'},
    {lat:'bad',lon:'32'}
  ]});
  assert.deepEqual(plain(result),[[[39,32],[39,33],[40,33],[39,32]]]);
  assert.equal(extractRings({type:'way',geometry:[{lat:39,lon:32},{lat:40,lon:33}]}),null);
});

test('relation ways join in either direction and preserve separate inner rings',()=>{
  const relation={type:'relation',members:[
    {role:'outer',geometry:[{lat:39,lon:32},{lat:39,lon:33}]},
    {role:'outer',geometry:[{lat:40,lon:33},{lat:39,lon:33}]},
    {role:'outer',geometry:[{lat:40,lon:32},{lat:40,lon:33}]},
    {role:'outer',geometry:[{lat:39,lon:32},{lat:40,lon:32}]},
    {role:'inner',geometry:[{lat:39.4,lon:32.4},{lat:39.4,lon:32.6},{lat:39.6,lon:32.6},{lat:39.6,lon:32.4}]}
  ]};
  const result=extractRings(relation);
  assert.equal(result.outer.length,1);
  assert.equal(result.inner.length,1);
  assert.deepEqual(result.outer[0][0],result.outer[0].at(-1));
  assert.deepEqual(result.inner[0][0],result.inner[0].at(-1));
  assert.deepEqual(plain(joinWaysToRings([[[0,0],[0,1]],[[1,1],[0,1]],[[1,0],[1,1]],[[0,0],[1,0]]])).length,1);
  assert.equal(extractRings({type:'relation',members:[{role:'inner',geometry:[{lat:0,lon:0},{lat:1,lon:0}]}]}),null);
});
