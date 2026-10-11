import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportLandcoverAnalysis} from '../scripts/lib/report-landcover-analysis.mjs';

const outer=[[39,32],[39.1,32],[39.1,32.1],[39,32]];
const report={classes:{water:{area:10}}};
function fakeContext({runs=[],features=[],inverse=null,onAnalyze=null}={}){
 const context={
  ringGeodesicArea:()=>54321,
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
  {x0:500000,x1:500100,y0:4300000,y1:4300100,epsg:32636,classKey:'hard'},
  {x0:500200,x1:500300,y0:4300200,y1:4300300,epsg:32636,classKey:'invalid'}
 ];
 const ctx=fakeContext({runs,inverse:(x,y,epsg)=>{
  calls.push([x,y,epsg]);
  return x===500200?{lon:NaN,lat:NaN}:{lon:32+(x-500000)/100000,lat:39+(y-4300000)/100000};
 }});
 const {runLULC}=createReportLandcoverAnalysis({parkOuter:async()=>({outer,holes:[]}),bootLC:()=>ctx});
 const result=await runLULC({area_m2:1000});
 assert.deepEqual(result.wruns,[{lo0:32,lo1:32.001,la0:39,la1:39.001,key:'hard'}]);
 assert.deepEqual(calls,[[500000,4300100,32636],[500100,4300000,32636],[500200,4300300,32636],[500300,4300200,32636]]);
 assert.equal(result.epsg,32636);
});
