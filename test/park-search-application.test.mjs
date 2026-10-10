import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/search-park-by-name.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_SEARCH_APPLICATION.create;
function setup(overrides={}){
  const calls={find:[],geocode:[],events:[]};
  const search=create({normalizeName:s=>s.toLowerCase().trim(),findRegistered:async prefix=>{calls.find.push(prefix);return[];},geocode:async query=>{calls.geocode.push(query);return{lat:40,lon:29};},onEvent:(...event)=>calls.events.push(event),...overrides});
  return{search,calls};
}

test('empty query stops; registered park wins before OSM geocoding',async()=>{
  const empty=setup();assert.equal((await empty.search('  ')).status,'empty-query');assert.equal(empty.calls.find.length,0);
  const park={id:7,name:'Göksu Parkı'};
  const local=setup({findRegistered:async prefix=>{local.calls.find.push(prefix);return[park];}});
  const result=await local.search(' Göksu ');
  assert.equal(result.status,'registered');assert.equal(result.park,park);assert.deepEqual(local.calls.geocode,[]);
});

test('DB failure is reported and search continues to geocoding',async()=>{
  const error=Error('db offline');const a=setup({findRegistered:async()=>{throw error;}});
  const result=await a.search('Kuğulu');
  assert.equal(result.status,'geocoded');assert.deepEqual(a.calls.events,[['database-error',error],['searching-osm','Kuğulu']]);
  assert.deepEqual(a.calls.geocode,['Kuğulu park']);
});

test('empty geocoder result and failed geocoder return distinct outcomes',async()=>{
  const missing=setup({geocode:async()=>null});assert.equal((await missing.search('Park')).status,'not-found');
  const error=Error('nominatim offline');const failed=setup({geocode:async()=>{throw error;}});
  const result=await failed.search('Park');assert.equal(result.status,'geocode-failed');assert.equal(result.error,error);
});
