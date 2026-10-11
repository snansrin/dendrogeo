import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportSnapshotApplication} from '../scripts/lib/report-snapshot-application.mjs';

const park={id:7,name:'Test Park',osm_key:'way/10',city:'Ankara',country:'Türkiye',area_m2:1000};
const row={
 id:1,point_id:2,species:'Acer spp.',grp:'Yapraklı',dbh_cm:12.345,girth_cm:38.783,height_m:3.5,
 carbon_kg:2.1,volume_m3:0.1,lat:39,lon:32,accuracy_m:4,photo_url:null,photo_file:null,
 created_at:'2026-10-11T12:00:00.000Z'
};
function setup({restOverride=null,rows=[row]}={}){
 const calls=[];
 const dependencies={
  rest:async(table,params)=>{
   calls.push({table,params});
   if(restOverride)return restOverride(table,params);
   if(table==='parks')return[park];
   return rows;
  },
  summarizeReportMeasurements:(records,area)=>({totals:{n:records.length,area},species:[],gps:{},period:{},moderation:{}}),
  mcTotalCI:()=>{},mcRowCI:()=>{},reportContext:{},reviewedSurface:()=>null,
  parkOuter:async()=>null,pointInPolygon:()=>false,bboxRing:()=>false,ringGeodesicAreaM2:()=>0,
  geometrySelfIntersections:()=>0,inventoryQa:()=>({checked:true}),loadSpeciesDict:()=>({}),
  loadRho:()=>({measurementLockId:'rho-lock-v1',measurementLockFingerprint:'sha256:rho'}),
  resolveReportAuthor:async()=>({name:'Contributor'}),
  renderMapPNG:()=>null,fmtDateDot:x=>String(x),runLULC:async()=>{throw Error('skipLulc should skip LULC');},
  DATASET_ASCII:'ESA WorldCover',ENGINE_VERSION:'engine-1',APP_VERSION:'3.0.0',GIT_COMMIT:'abc123',
  buildReportProvenance:values=>values,DATASET_DEFAULT:'ESA WorldCover 10 m',MC_CFG:{N:10},
  canonicalHash:()=> 'snapshot-hash'
 };
 return{application:createReportSnapshotApplication(dependencies),calls};
}

test('snapshot application preserves the public snapshot and hash result',async()=>{
 const{application,calls}=setup();
 const result=await application.buildSnapshot(7,{skipLulc:true});
 assert.equal(result.hash,'snapshot-hash');
 assert.equal(result.snap.park.id,7);
 assert.equal(result.snap.totals.n,1);
 assert.deepEqual(result.snap.rows[0],{
  id:1,point_id:2,species:'Acer spp.',grp:'Yapraklı',dbh_cm:12.345,girth_cm:38.783,height_m:3.5,
  carbon_kg:2.1,volume_m3:0.1,lat:39,lon:32,acc_m:4,photo:false,photo_file:null,date:'2026-10-11'
 });
 assert.equal(calls[0].table,'parks');
 assert.match(calls[1].params.select,/girth_cm,volume_m3/);
 assert.equal(calls[1].params.status,'eq.Onaylı');
});

test('legacy measurements schema retries without girth and volume columns',async()=>{
 const{application,calls}=setup({restOverride:async(table,params)=>{
  if(table==='parks')return[park];
  if(params.select.includes('girth_cm'))throw Error('column not found');
  return[row];
 }});
 const result=await application.buildSnapshot(7,{skipLulc:true});
 assert.equal(calls.filter(call=>call.table==='measurements').length,2);
 assert.doesNotMatch(calls[2].params.select,/girth_cm|volume_m3/);
 assert.equal(result.snap.rows[0].dbh_cm,12.345);
});

test('parks without approved measurements still fail before report creation',async()=>{
 const{application}=setup({rows:[]});
 await assert.rejects(application.buildSnapshot(7,{skipLulc:true}),/onaylı kayıt yok/);
});
