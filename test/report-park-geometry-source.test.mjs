import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportParkGeometrySource} from '../scripts/lib/report-park-geometry-source.mjs';

const ring=[[39,32],[39.1,32],[39.1,32.1],[39,32]];
const hole=[[39.02,32.02],[39.03,32.02],[39.03,32.03],[39.02,32.02]];

test('accepted non-bbox geometry is preferred without a network request',async()=>{
 let calls=0;
 const parkOuter=createReportParkGeometrySource({
  fetch:async()=>{calls++;throw Error('network should not be used');},
  bboxRing:()=>false,extractRings:()=>null
 });
 const result=await parkOuter({geom_json:{outer:[ring],inner:[hole]},osm_key:'way/22'});
 assert.deepEqual(result,{outer:ring,holes:[hole]});
 assert.equal(calls,0);
});

test('bbox geometry falls back to OSM way nodes in the way order',async()=>{
 const calls=[];
 const parkOuter=createReportParkGeometrySource({
  fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({elements:[
   {type:'node',id:1,lat:39,lon:32},{type:'node',id:2,lat:39.1,lon:32},
   {type:'node',id:3,lat:39.1,lon:32.1},{type:'way',nodes:[1,2,3,1]}
  ]})};},
  bboxRing:()=>true,extractRings:()=>null
 });
 const result=await parkOuter({geom_json:{outer:[ring]},osm_key:'way/123'});
 assert.deepEqual(result,{outer:[[39,32],[39.1,32],[39.1,32.1],[39,32]],holes:[]});
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/api\.openstreetmap\.org\/api\/0\.6\/way\/123\/full\.json/);
});

test('relation lookup rotates Overpass mirrors and retains inner rings',async()=>{
 const calls=[];
 let extracted=null;
 const parkOuter=createReportParkGeometrySource({
  fetch:async(url,options)=>{
   calls.push({url,options});
   if(calls.length===1)throw Error('mirror unavailable');
   return{ok:true,json:async()=>({elements:[{type:'relation',id:456}]})};
  },
  bboxRing:()=>true,
  extractRings:element=>{extracted=element;return{outer:[ring],inner:[hole]};}
 });
 const result=await parkOuter({geom_json:{outer:[ring]},osm_key:'relation/456'});
 assert.deepEqual(result,{outer:ring,holes:[hole]});
 assert.equal(calls.length,2);
 assert.equal(extracted.id,456);
 assert.match(calls[0].url,/overpass\.private\.coffee/);
 assert.match(calls[1].url,/overpass-api\.de/);
 assert.equal(calls[1].options.method,'POST');
});

test('invalid OSM keys and incomplete ways return null',async()=>{
 const parkOuter=createReportParkGeometrySource({
  fetch:async()=>({ok:true,json:async()=>({elements:[{type:'way',nodes:[99,98,97,96]}]})}),
  bboxRing:()=>false,extractRings:()=>null
 });
 assert.equal(await parkOuter({osm_key:'not-an-osm-key'}),null);
 assert.equal(await parkOuter({osm_key:'way/77'}),null);
});
