import assert from 'node:assert/strict';
import axe from 'axe-core';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';

// Exercise the actual dialog and validators without creating publication requests.
const server=await serveFixture(),chromium=await loadChromium(),browser=await chromium.launch({headless:true});
try{
 for(const width of [360,390,430,1280]){
  const page=await browser.newPage({viewport:{width,height:840},bypassCSP:true}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await isolateAccount(page);
  await page.goto(server.url,{waitUntil:'domcontentloaded'});
  await page.locator('#shell').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
  const scroll=await page.evaluate(()=>({window:window.scrollY,main:document.getElementById('main').scrollTop,overflow:document.documentElement.style.overflow}));
  await page.evaluate(()=>{window.__reportFormResult=dgReportQuestions(25,'Fixture project');});
  const dialog=page.locator('.dg-academic-dialog');
  await dialog.waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'dgReportQuestionTitle');
  assert.equal(await dialog.locator('[required]').count(),0);
  const before=await dialog.boundingBox(),footer=await dialog.locator('.dg-report-dialog-footer').boundingBox();
  assert.ok(before.x>=0&&before.x+before.width<=width);
  await dialog.locator('.dg-report-extra summary').click();
  await page.addScriptTag({content:axe.source});
  const violations=await page.evaluate(async()=>{const result=await axe.run(document.querySelector('.dg-academic-dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return result.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)}));});
  assert.deepEqual(violations,[]);
  await dialog.locator('[name=purpose]').fill('Envanter');
  await dialog.locator('.dg-report-dialog-body').evaluate(element=>{element.scrollTop=element.scrollHeight;});
  const after=await dialog.boundingBox(),afterFooter=await dialog.locator('.dg-report-dialog-footer').boundingBox();
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(before[key]-after[key])<1,`dialog ${key} moved at ${width}px`);
  assert.ok(Math.abs(footer.y-afterFooter.y)<1,'publication actions moved');
  const background=await page.evaluate(()=>({window:window.scrollY,main:document.getElementById('main').scrollTop}));
  assert.equal(background.window,scroll.window);assert.equal(background.main,scroll.main);
  await dialog.locator('input,textarea,select').evaluateAll(elements=>elements.forEach(element=>{if(element.type==='checkbox')element.checked=false;else element.value='';}));
  await dialog.locator('[type=submit]').click();
  const result=await page.evaluate(()=>window.__reportFormResult);
  assert.equal(result.publication_consent,true);
  for(const [key,value] of Object.entries(result.study))assert.equal(value,key==='independent'?false:'',key);
  assert.equal(await dialog.count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),scroll.overflow);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,optionalFields:true,blankSubmission:true,stationaryDialog:true,stationaryActions:true,backgroundScrollLocked:true,accessibleDialog:true,noPublicationWrites:true}));
  await page.close();
 }
}finally{await browser.close();await server.close();}
