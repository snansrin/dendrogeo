import assert from 'node:assert/strict';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const chromium=await loadChromium(),engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.locator('#shell').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(async()=>{await loadProjects();PROJ_LIST=[{id:1,park_id:25,name:'Fixture project',owner:USER.id}];document.getElementById('mProject').innerHTML='<option value="1">Fixture project</option>';go('measure');});await page.locator('#v-measure.on').waitFor({state:'visible'});
 await page.evaluate(()=>{
  PROJ_LIST=[{id:1,park_id:25,name:'Fixture project',owner:USER.id}];document.getElementById('mProject').innerHTML='<option value="1">Fixture project</option>';
  EDIT_ID=7;DG_MEASUREMENT_EDIT_BASELINE={id:7,owner:USER.id,height_m:10,photo_url:null,client_id:'original-client'};
  document.getElementById('mPoint').value='35';document.getElementById('mNo').value='1';document.getElementById('mGroup').value='İBRELİ';fillSpecies();document.getElementById('mSpecies').value='GÖKNAR';document.getElementById('mDbh').value='80';document.getElementById('mHeight').value='12';dgParkGate();
  const from=sb.from.bind(sb);window.__dgWriteMode='empty';window.__dgWriteCalls=[];
  sb.from=table=>table!=='measurements'?from(table):{select:()=>({eq(){return this;},async maybeSingle(){return{data:null,error:{code:'42501',message:'Fixture-read-denied'}};}}),update:payload=>{const filters=[];const chain={eq:(k,v)=>{filters.push([k,v]);return chain},is:(k,v)=>{filters.push([k,v]);return chain},select:async()=>{__dgWriteCalls.push({payload,filters});return __dgWriteMode==='error'?{error:{code:'23514',message:'<img src="/injected-error-image" alt="unsafe">'}}:{error:null,data:__dgWriteMode==='success'?[{id:7}]:[]}}};return chain}};
 });
 await page.locator('#saveBtn').tap();await page.waitForFunction(()=>document.getElementById('toastWrap').textContent.includes('formda korundu'));
 assert.equal(await page.locator('#mHeight').inputValue(),'12');assert.equal(await page.evaluate(()=>EDIT_ID),7);assert.equal(await page.locator('#saveBtn').isEnabled(),true);
 assert.ok(await page.evaluate(()=>!__dgWriteCalls[0].filters.some(([k])=>k==='height_m')),'recorded dimensions must not be SQL equality predicates');
 await page.evaluate(()=>{window.__dgWriteMode='error';document.getElementById('toastWrap').replaceChildren()});await page.locator('#saveBtn').tap();await page.waitForFunction(()=>document.getElementById('toastWrap').textContent.includes('<img'));
 assert.equal(await page.locator('#toastWrap img').count(),0,'server errors must be text, never injected markup');assert.equal(await page.locator('#mHeight').inputValue(),'12');
 await page.evaluate(()=>{__dgWriteMode='empty';dgSetLang('en');document.getElementById('toastWrap').replaceChildren()});await page.locator('#saveBtn').tap();await page.waitForFunction(()=>document.getElementById('toastWrap').textContent.includes('Your edits remain in the form'));
 await page.evaluate(()=>{__dgWriteMode='success';dgSetLang('tr')});await page.locator('#saveBtn').tap();await page.waitForFunction(()=>EDIT_ID===null&&document.getElementById('mHeight').value==='');
 assert.equal(await page.evaluate(()=>__dgWriteCalls.every(c=>c.payload.client_id!=='original-client'&&c.filters.some(([k,v])=>k==='id'&&v===7)&&c.filters.some(([k,v])=>k==='client_id'&&v==='original-client'))),true);assert.deepEqual(errors,[]);
 await page.evaluate(()=>toast('<img src="/injected-error-image" onerror="alert(1)"><b onclick="alert(1)">Safe help</b><br>Second line','err','<img src="/injected-icon">'));
 assert.equal(await page.locator('#toastWrap img,#toastWrap [onclick],#toastWrap script').count(),0);assert.ok(await page.locator('#toastWrap b').count());assert.ok(await page.locator('#toastWrap br').count());
 console.log(JSON.stringify({browser:process.env.DG_UI_BROWSER||'chromium',width,conflictRetainsForm:true,confirmedWriteResets:true,atomicSnapshot:true,stableIdentity:true,safeErrorText:true,bilingualError:true}));await context.close();
}}finally{await browser.close();await server.close();}
