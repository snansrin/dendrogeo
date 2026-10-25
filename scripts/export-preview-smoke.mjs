import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import axe from 'axe-core';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.locator('#side [data-dg-view="export"]').click();
 await page.locator('.export-panel').filter({has:page.locator('[data-dg-export-action="csv-preview"]')}).locator('summary').click();
 const modal=page.getByRole('dialog'),csv=page.locator('[data-dg-export-action="csv-preview"]');
 await page.evaluate(()=>{window.__previewBackgroundEsc=0;for(const name of ['keydown','keyup'])document.addEventListener(name,event=>{if(event.key==='Escape')__previewBackgroundEsc++;});});
 await csv.click();await modal.waitFor({state:'visible'});
 assert.match(await modal.innerText(),/Önizlenecek ölçüm kaydı yok/);
 assert.equal(await page.evaluate(()=>document.querySelector('#previewModal').contains(document.activeElement)),true,'focus enters preview');
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#previewModal').contains(document.activeElement)),true,'Tab stays in preview');}
 await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>__previewBackgroundEsc),0,'closing a preview must not invoke background Escape shortcuts');
 assert.equal(await csv.evaluate(el=>el===document.activeElement),true,'focus returns to preview trigger');
 assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 const expected=await page.evaluate(()=>{
  const row={point_id:7,measurement_no:1,created_at:'2026-10-22T08:00:00Z',lat:39.99,lon:32.65,grp:'YAPRAKLI',species:'Çınar',girth_cm:94.24777960769379,dbh_cm:30,height_m:12,carbon_kg:50};
  window.getMine=async()=>[row];
  return {csv:fullCSV([row]),geo:dgSerializeUserExport('geojson',[row],true)};
 });
 for(const [action,title,file,content]of [
  ['csv-preview','CSV Önizleme','dendrogeo.csv',expected.csv],
  ['geo-preview','GeoJSON Önizleme','dendrogeo.geojson',expected.geo],
  ['qgis-preview','QGIS CSV Önizleme','dendrogeo_qgis.csv',expected.csv]
 ]){
  const trigger=page.locator('[data-dg-export-action="'+action+'"]');await trigger.click();await modal.waitFor({state:'visible'});
  assert.ok((await page.locator('#pvTitle').innerText()).startsWith(title));
  if(action!=='geo-preview')assert.equal(await modal.locator('tbody tr').count(),1);
  const downloadEvent=page.waitForEvent('download');await page.locator('#pvDownload').click();const download=await downloadEvent;
  assert.equal(download.suggestedFilename(),file);assert.equal(readFileSync(await download.path(),'utf8'),content,'preview downloads original serializer output');
  await modal.getByRole('button',{name:'✕ Kapat',exact:true}).click();await modal.waitFor({state:'hidden'});
 }
 await page.evaluate(()=>DG_PARK_REPORT_PREVIEW_UI.show({title:'Test parkı raporu',body:'<p>Yerel test raporu</p>',csv:'park,value\nfixture,1',fileName:'park-report.csv',elements:{title:document.getElementById('pvTitle'),body:document.getElementById('pvBody'),download:document.getElementById('pvDownload'),modal:document.getElementById('previewModal')},download:dl}));
 await modal.waitFor({state:'visible'});assert.match(await modal.innerText(),/Yerel test raporu/);await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
 await page.evaluate(()=>openPreview('CSV hücreleri','name,note\n"A, B","İlk satır\nİkinci ""satır"""',true,'quoted.csv'));
 assert.deepEqual(await modal.locator('tbody td').allTextContents(),['A, B','İlk satır\nİkinci "satır"']);
 await page.evaluate(axe.source);
 for(const theme of ['light','dark']){
  await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
  const violations=await page.evaluate(async()=> (await axe.run(document.getElementById('previewModal'))).violations.map(v=>({id:v.id,impact:v.impact})));
  assert.deepEqual(violations,[]);
  if(process.env.DG_QA_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.DG_QA_SCREENSHOT_DIR,'export-preview-'+engine.name()+'-'+theme+'-'+width+'.png')});
 }
 await modal.getByRole('button',{name:'✕ Kapat',exact:true}).click();
 await page.locator('#side [data-dg-view="projects"]').click();
 assert.equal(await page.getByRole('textbox',{name:'Proje etiketi',exact:true}).count(),1,'help must not pollute the field name');
 for(const lang of ['en','tr']){
  await page.evaluate(value=>dgSetLang(value),lang);
  assert.equal(await page.locator('#pLabel').getAttribute('aria-label'),(await page.locator('label[for="pLabel"]').textContent()).replace(/\s+/g,' ').trim(),'field name follows the visible translated label');
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:engine.name(),width,closeButton:true,escape:true,focusRestored:true,focusContained:true,emptyState:true,threeDownloadsExact:true,parkPreview:true,csvQuotes:true,fieldName:true}));
 await page.close();
}}finally{await browser.close();await server.close();}
