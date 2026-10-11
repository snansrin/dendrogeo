import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportLandcoverAnalysis} from '../scripts/lib/report-landcover-analysis.mjs';

const outer=[[39,32],[39.1,32],[39.1,32.1],[39,32]];
const report={classes:{water:{area:10}}};
function fakeContext({runs=[],features=[],inverse=null,onAnalyze=null}={}){
 const context={
  dgLcAnalyze:async options=>{onAnalyze?.(options);return report;},
  __dgLast:()=>({result:{runs}}),
  dgLcCellsGeoJson:()=>({features}),
  dgLcUtmInverse:(x,y,epsg)=>inverse?inverse(x,y,epsg):{lon:x,lat:y}
 };
 return context;
}

test('no park boundary skips the land-cover engine',async()=>{
 let booted=0;
 const {runLULC}=createReportLandcoverAnalysis({parkOuter:async()=>null,bootLC:()=>{booted++;}});
 assert.equal(await runLULC({id:1}),null);
 assert.equal(booted,0);
});

test('uses supplied boundary and park area; preserves report and cell outputs',async()=>{
 const feature={type:'Feature',properties:{class:'green'}};
 let analysisOptions=null;
 const ctx=fakeContext({features:[feature],onAnalyze:options=>{analysisOptions=options;}});
 const {runLULC}=createReportLandcoverAnalysis({parkOuter:async()=>{throw Error('supplied geometry should win');},bootLC:()=>ctx});
 const result=await runLULC({area_m2:12345},{outer,holes:[]});
 assert.deepEqual(analysisOptions,{outer:[outer],holes:[],parkAreaM2:12345});
 assert.equal(result.report,report);
 assert.deepEqual(result.cells,[feature]);
 assert.equal(result.epsg,null);
});

test('converts degree runs to bounded map coordinates and preserves EPSG',async()=>{
 const runs=[
  {x0:32,x1:32.1,y0:39,y1:39.1,epsg:4326,classKey:'water'},
  {x0:32.1,x1:32.2,y0:39.1,y1:39.2,epsg:4326,classKey:'green'}
 ];
 const {runLULC}=createReportLandcoverAnalysis({parkOuter:async()=>({outer,holes:[]}),bootLC:()=>fakeContext({runs})});
 const result=await runLULC({area_m2:0});
 assert.deepEqual(result.wruns,[
  {lo0:32,lo1:32.1,la0:39,la1:39.1,key:'water'},
  {lo0:32.1,lo1:32.2,la0:39.1,la1:39.2,key:'green'}
 ]);
 assert.equal(result.epsg,4326);
});

test('uses UTM inverse projection and drops non-finite runs',async()=>{
 const calls=[];
 const runs=[
  {x0:1,x1:2,y0:3,y1:4,epsg:32636,classKey:'hard'},
  {x0:5,x1:6,y0:7,y1:8,epsg:32636,classKey:'invalid'}
 ];
 const ctx=fakeContext({runs,inverse:(x,y,epsg)=>{calls.push([x,y,epsg]);return x===5?{lon:NaN,lat:NaN}:{lon:x/100,lat:y/100};}});
 const {runLULC}=createReportLandcoverAnalysis({parkOuter:async()=>({outer,holes:[]}),bootLC:()=>ctx});
 const result=await runLULC({area_m2:1000});
 assert.deepEqual(result.wruns,[{lo0:0.01,lo1:0.02,la0:0.03,la1:0.04,key:'hard'}]);
 assert.deepEqual(calls,[[1,4,32636],[2,3,32636],[5,8,32636],[6,7,32636]]);
 assert.equal(result.epsg,32636);
});
