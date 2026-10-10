import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{},encodeURIComponent});
vm.runInContext(readFileSync(new URL('../src/adapters/parks/park-search.js',import.meta.url),'utf8'),context);

test('park search adapter queries registered rows and geocodes OSM search text',async()=>{
  const calls=[];const row={id:4,name:'Kuğulu Parkı'};
  const query={select(){calls.push('select');return this;},ilike(...x){calls.push(['ilike',...x]);return this;},order(...x){calls.push(['order',...x]);return this;},limit(...x){calls.push(['limit',...x]);return Promise.resolve({data:[row]});}};
  let requested='';
  const adapter=context.window.DG_PARK_SEARCH_ADAPTER.create({getClient:()=>({from:t=>{calls.push(['from',t]);return query;}}),getFetch:()=>async url=>{requested=url;return{json:async()=>[{lat:'40.1',lon:'29.2'}]};}});
  assert.equal((await adapter.findRegistered('kugulu'))[0],row);
  const point=await adapter.geocode('Kuğulu park');
  assert.deepEqual(JSON.parse(JSON.stringify(point)),{lat:40.1,lon:29.2});
  assert.match(requested,/q=Ku%C4%9Fulu%20park/);
  assert.deepEqual(calls[2],['ilike','name_norm','kugulu%']);
});
