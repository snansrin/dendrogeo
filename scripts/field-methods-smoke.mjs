import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import axe from 'axe-core';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {renderReport} from './make-report.mjs';
import {canonicalHash} from './lib/canonical-hash.mjs';

const server=await serveFixture(),chromium=await loadChromium(),browser=await chromium.launch({headless:true});
const out=process.env.DG_SCIENTIFIC_ARTIFACTS||join(tmpdir(),'dendrogeo-field-methods');mkdirSync(out,{recursive:true});
try {
 for(const width of [360,390,430])for(const theme of ['light','dark'])for(const lang of ['tr','en']) {
  const page=await browser.newPage({viewport:{width,height:840},bypassCSP:true,serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await isolateAccount(page);
  await page.goto(server.url,{waitUntil:'domcontentloaded'});
  await page.locator('#shell').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
  await page.evaluate(({theme,lang})=>{document.documentElement.dataset.theme=theme;dgSetLang(lang);window.__fieldResult=dgReportQuestions(25,'Fixture project');},{theme,lang});
  const dialog=page.locator('.dg-academic-dialog'),body=dialog.locator('.dg-report-dialog-body');
  await dialog.waitFor({state:'visible'});
  assert.equal(await dialog.locator('[required]').count(),0);
  const before=await dialog.boundingBox();
  await dialog.locator('.dg-field-protocol summary').click();
  if(lang==='en'){
   await page.waitForFunction(()=>document.querySelector('.dg-field-protocol summary').textContent==='Field validation details (optional)');
   assert.equal(await dialog.locator('h2').innerText(),'Scientific report details');
   assert.match(await dialog.locator('[type=submit]').innerText(),/Publish report/);
   assert.match(await dialog.locator('.dg-report-dialog-heading .dg-meta').innerText(),/Measurements and the accepted analysis are transferred automatically/);
  }
  await dialog.locator('[name=inventory_scope]').selectOption('partial');
  await dialog.locator('[name=observers]').fill('Fixture team');
  await dialog.locator('[name=calibration]').fill('Not documented');
  await dialog.locator('[name=repeat_measurements]').fill('No repeat measurement');
  await body.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  const after=await dialog.boundingBox();
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(before[key]-after[key])<1,`${width}/${theme}/${lang}: modal moved`);
  const overflow=await dialog.evaluate(element=>[element.scrollWidth,element.clientWidth]);
  assert.ok(overflow[0]<=overflow[1]+1);
  await page.evaluate(axe.source);
  const violations=await page.evaluate(async()=>(await axe.run(document.querySelector('.dg-academic-dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(({id,nodes})=>({id,targets:nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[],`${width}/${theme}/${lang}: accessibility`);
  if(width===390)await dialog.screenshot({path:join(out,`form-${theme}-${lang}.png`)});
  await dialog.locator('[type=submit]').click();
  const result=await page.evaluate(()=>window.__fieldResult);
  assert.equal(result.study.inventory_scope,'partial');
  assert.equal(result.study.observers,'Fixture team');
  assert.equal(result.study.calibration,'Not documented');
  assert.equal(result.study.repeat_measurements,'No repeat measurement');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,theme,lang,optional:true,roundTrip:true,stationary:true,accessible:true,noProductionWrites:true}));
  await page.close();
 }
 // New-report presentation only: no archive files are rewritten or published.
 const snap=JSON.parse(readFileSync(new URL('../test/fixtures/report-snapshot.json',import.meta.url),'utf8'));
 snap.study={inventory_scope:'partial',observers:'</script><script>window.injected=true</script>',calibration:'Not documented'};
 const html=renderReport(snap,{id:'DGR-2026-0021',hash:canonicalHash(snap)});
 for(const width of [360,390,430]) {
  const page=await browser.newPage({viewport:{width,height:840},bypassCSP:true,serviceWorkers:'block'});
  await isolateAccount(page,false);
  await page.goto(server.url,{waitUntil:'domcontentloaded'});
  await page.setContent(html,{waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  await page.waitForFunction(()=>document.getElementById('dgVerify').textContent.includes('İçerik bütünlüğü doğrulandı'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'report overflow');
  assert.equal(await page.locator('table.uncertainty').evaluate(table=>table.getBoundingClientRect().width<=table.parentElement.clientWidth+1),true,'uncertainty table must fit without horizontal scrolling');
  assert.equal(await page.evaluate(()=>DG_DATA.totals.carbon_kg),snap.totals.carbon_kg);
  if(width===390)await page.locator('table').filter({has:page.locator('caption',{hasText:'Belirsizlik kaynakları'})}).screenshot({path:join(out,'report-uncertainty.png')});
  console.log(JSON.stringify({reportWidth:width,hashVerified:true,unchangedTotals:true,safeScriptData:true,noOverflow:true}));
  await page.close();
 }
}finally{await browser.close();await server.close();}
