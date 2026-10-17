import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/application/parks/recover-park-boundary.js',import.meta.url),'utf8'),{window});
const park={type:'way',id:205225595,tags:{leisure:'park',name:'Harikalar Diyarı'},geometry:[{lat:39.98,lon:32.59}]};
function setup(overrides={}){const cache=new Map(),calls=[];const recover=window.DG_RECOVER_PARK_BOUNDARY.create({findGeocoded:async()=>[],loadMap:async bounds=>{calls.push(bounds);return{complete:true,elements:[park]};},extractRings:element=>element.geometry,areaOf:()=>760000,containsPoint:()=>true,cache,now:()=>123,...overrides});return{recover,cache,calls};}
test('native OSM geometry recovers a containing park after geocoder transport failure',async()=>{
 const x=setup({findGeocoded:async()=>{throw Error('Failed to fetch');}}),result=await x.recover(39.98,32.59);
 assert.equal(result[0].id,205225595);assert.strictEqual(result[0].rings,park.geometry);assert.equal(result[0].boundaryProvider,'osm-api');assert.equal(x.calls.length,1);assert.equal(x.cache.get('way/205225595').time,123);
});
test('successful geocoder does not request the native API again',async()=>{
 const parks=[{id:1}],x=setup({findGeocoded:async()=>parks});assert.strictEqual(await x.recover(39,32),parks);assert.equal(x.calls.length,0);
});
test('partial data, non-containing geometry and non-park tags never fabricate a park bbox',async()=>{
 for(const override of [{loadMap:async()=>({complete:false,elements:[park]})},{containsPoint:()=>false},{loadMap:async()=>({complete:true,elements:[{...park,tags:{building:'yes'}}]})}]){assert.equal((await setup(override).recover(39,32)).length,0);}
});

test('transport failure remains an error when every recovery source fails',async()=>{const x=setup({findGeocoded:async()=>{throw Error('offline');},loadMap:async()=>null});await assert.rejects(x.recover(39,32),/offline/);});
