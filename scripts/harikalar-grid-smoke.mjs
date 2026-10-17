import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const input=JSON.parse(gunzipSync(readFileSync(new URL('../test/fixtures/harikalar-grid-surface.json.gz',import.meta.url))));
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const ringFailure='Unable to complete output ring starting at [977347, 734605]. Last matching segment found ends at [1159519, 683435].';
const failures=process.env.DG_GRID_FAULT_SEQUENCE==='ring'
 ?[ringFailure,ringFailure]
 :['Unable to find segment #117295 [218.064, 445.17399999999986] -> [218.06400000000005, 445.17399999999986] in SweepLine tree.',ringFailure];
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});let injected=0;
 // Fail both floating-point attempts in a real Worker with the real park data.
 await context.route('**/src/adapters/surface/clip-grid-geometry.js*',async route=>{
  const response=await route.fetch();injected++;
  const fault=`\n{let index=0;const messages=${JSON.stringify(failures)},previous=window.DG_CLIP_GRID_GEOMETRY.clip;window.DG_CLIP_GRID_GEOMETRY.clip=(op,g,deps)=>previous(op,g,{...deps,run:(...args)=>{if(index<messages.length)throw Error(messages[index++]);return deps.run(...args);}});}`;
  await route.fulfill({response,body:await response.text()+fault});
 });
 const page=await context.newPage();await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(async()=>{await dgEnsureLulc();});
 for(const greenOnly of [false,true]){
  const started=Date.now();
  const outcome=await page.evaluate(async input=>{
   const before=JSON.stringify(input),result=await dgSurfaceWorkerJob(input),park=dgSurfacePark(input.outer,input.holes,input.epsg);
   const exclusions=input.parts.filter(p=>p.type!=='green').map(p=>({geom:p.geom,bounds:dgSurfaceBounds(p.geom)}));
   const violations=[];
   const safe=result.cells.every(cell=>{
    const p=dgLcUtmForward(cell.lat,cell.lon,input.epsg),point=[p.x,p.y];
    const parkDistance=dgGridPointDistance(point,park);
    if(parkDistance<input.clearance-.002){violations.push({point,parkDistance,cellClearance:cell.clearanceM});return false;}
    return !input.greenOnly||exclusions.every(({geom,bounds:b})=>{
      if(p.x<b[0]-input.clearance||p.x>b[2]+input.clearance||p.y<b[1]-input.clearance||p.y>b[3]+input.clearance)return true;
      const distance=dgGridPointDistance(point,geom);
      if(distance>-input.clearance+.002){violations.push({point,exclusionDistance:distance,cellClearance:cell.clearanceM});return false;}
      return true;
    });
   });
   return{count:result.cells.length,safe,violations,unchanged:before===JSON.stringify(input)};
  },{...input,greenOnly});
  assert.ok(outcome.count>0);assert.ok(outcome.safe,'Points retain park-boundary clearance and, when green-only is enabled, non-green-class clearance: '+JSON.stringify(outcome.violations));assert.ok(outcome.unchanged);
  console.log(JSON.stringify({engine:engine.name(),park:'Harikalar Diyarı',realRasterCells:input.meta.cellCount,greenOnly,elapsedMs:Date.now()-started,forcedDoubleNumericalFailure:true,failureSequence:process.env.DG_GRID_FAULT_SEQUENCE||'mixed',...outcome}));
 }
 assert.ok(injected>=3,'Page and both grid Workers loaded the failing primary library');
}finally{await browser.close();await server.close();}
