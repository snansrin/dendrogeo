import assert from 'node:assert/strict';
import axe from 'axe-core';
import {join} from 'node:path';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';

const server=await serveFixture(),chromium=await loadChromium(),browser=await chromium.launch({headless:true});
try{
 for(const width of [360,390,430,1280]){
  const page=await browser.newPage({viewport:{width,height:900},bypassCSP:true}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const cancelDialog=async action=>{let seen=false;page.once('dialog',async dialog=>{seen=true;await dialog.dismiss();});await action();assert.equal(seen,true);};
  const cancelTypedDelete=async action=>{
   await action();
   const dialog=page.locator('dialog[aria-labelledby="dgTypedDeleteTitle"]');
   await dialog.waitFor({state:'visible'});
   const input=dialog.locator('#dgTypedDeleteInput'),submit=dialog.locator('button[type="submit"]');
   assert.equal(await submit.isDisabled(),true,'delete starts disabled');
   await input.fill('YANLIŞ ONAY');
   assert.equal(await submit.isDisabled(),true,'wrong phrase cannot delete');
   await dialog.getByRole('button',{name:'Vazgeç'}).click();
   await dialog.waitFor({state:'hidden'});
  };
  await isolateAccount(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});
  await page.locator('#shell').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
  await page.evaluate(()=>{
   PROFILE.role='owner';document.getElementById('miAdmin').style.display='';
   window.DG_ADMIN_TREE_ACTIONS.updateBadge(3);
   window.DG_DATA_REQUEST_PENDING_TABLE_UI.updateCounts(document,[{id:1},{id:2}]);
  });
  assert.equal(await page.locator('#adminDataRequestBadge').isVisible(),true);
  assert.equal(await page.locator('#adminDataRequestBadge').innerText(),'2');
  assert.equal(await page.locator('#adminPendingBadge').innerText(),'3');
  assert.equal(await page.locator('#adminDataRequestBadge').evaluate(el=>getComputedStyle(el).backgroundColor),await page.locator('#adminPendingBadge').evaluate(el=>getComputedStyle(el).backgroundColor));
  if(process.env.DG_QA_SCREENSHOT_DIR&&width===390){await page.locator('#miAdmin').scrollIntoViewIfNeeded();await page.locator('#side').screenshot({path:join(process.env.DG_QA_SCREENSHOT_DIR,'data-request-badge-390.png')});}
  await page.evaluate(()=>window.DG_DATA_REQUEST_PENDING_TABLE_UI.updateCounts(document,[]));
  assert.equal(await page.locator('#adminDataRequestBadge').isVisible(),false);
  assert.equal(await page.locator('#adminPendingBadge').isVisible(),true);
  await page.evaluate(()=>{
   document.querySelectorAll('.view').forEach(view=>view.classList.toggle('on',view.id==='v-admin'));
   window.DG_ADMIN_STORAGE_USAGE_UI.render(document.getElementById('storeBar'),document.getElementById('storeInfo'),{bytes:950000000,count:2000,format:(text,values)=>text.replace(/\{(\w+)\}/g,(_,key)=>values[key])});
  });
  assert.match(await page.locator('#storeInfo').innerText(),/950\.0 MB \/ 1000 MB/);
  assert.equal(await page.locator('#storeWarning').isVisible(),true);
  assert.match(await page.locator('#storeWarning').innerText(),/%95/);
  assert.equal(await page.locator('#storeWarning').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'storage warning fits phone widths');
  assert.equal(await page.locator('#parkAdminBox,[data-park-admin-action],[data-dg-admin-panel-action="reload-parks"]').count(),0,'park identity management is removed');
  assert.equal(await page.locator('#v-admin').innerText().then(text=>text.includes('Park Kimlikleri')),false);
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>{document.getElementById('shell').style.display='none';document.getElementById('landing').style.display='block';});
  const chips=await page.locator('.dg-showcase-animation .chip').evaluateAll(elements=>elements.map(element=>{const style=getComputedStyle(element);return{background:style.backgroundColor,shadow:style.boxShadow};}));
  assert.equal(chips.length,3);for(const chip of chips){assert.equal(chip.background,'rgba(0, 0, 0, 0)');assert.equal(chip.shadow,'none');}
  console.log(JSON.stringify({width,parkIdentityManagementRemoved:true,adminBadgesPreserved:true,storageWarningPreserved:true,transparentReadouts:true}));
  await page.close();
 }
}finally{await browser.close();await server.close();}
