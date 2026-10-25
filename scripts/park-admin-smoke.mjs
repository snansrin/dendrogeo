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
  await page.evaluate(()=>{
   PROFILE.role='owner';
   document.querySelectorAll('.view').forEach(view=>view.classList.toggle('on',view.id==='v-admin'));
   const parks=[
    {id:5,name:'Atatürk Çocukları ve Doğal Yaşam Parkı',city:'Ankara',osm_key:'way/5',area_m2:796000,source:'backfill',creator:{full_name:'Sinan Şirin'},created_at:'2026-09-01'},
    {id:25,name:'Göksu Parkı',city:'Ankara',osm_key:'way/25',area_m2:501000,source:'osm',creator:{full_name:'Nagihan Şirin'},created_at:'2026-09-15'},
    {id:13,name:'İsimsiz Park',city:'Gazimağusa',osm_key:'way/13',area_m2:250,creator:{full_name:'Ada Araştırmacı'},created_at:'2026-10-01'},
    {id:28,name:'Boş Park',city:'Bursa',osm_key:'way/28',area_m2:1200}
   ];
   DG_PARK_ADMIN_CONTROLLER.state.setState({rows:parks});
   DG_PARK_ADMIN_CONTROLLER.renderParkAdmin([{park_id:5},{park_id:25},{park_id:13}],Array.from({length:57},()=>({park_id:25})));
  });
  const box=page.locator('#parkAdminBox'),rows=box.locator('tbody tr'),search=box.locator('[data-park-admin-search]');
  assert.equal(await rows.count(),3);assert.match(await rows.first().innerText(),/Atatürk/);
  assert.match(await box.innerText(),/Nagihan Şirin/);
  assert.equal(await rows.first().locator('[data-park-admin-action="rename"]').isVisible(),true,'rename is directly visible');
  assert.equal(await rows.first().locator('[data-park-admin-action="delete"]').isVisible(),true,'delete is directly visible');
  await search.fill('Boş Park');assert.equal(await rows.count(),1);assert.match(await rows.first().innerText(),/Boş Park/);
  await cancelDialog(()=>rows.first().locator('[data-park-admin-action="delete"]').click());
  await search.fill('');await search.pressSequentially('Nagihan');assert.equal(await rows.count(),1);assert.match(await rows.first().innerText(),/Göksu/);
  assert.equal(await search.evaluate(element=>element===document.activeElement),true);
  await box.locator('[data-park-admin-menu]>summary').click();
  await box.locator('[data-park-admin-merge]>summary').click();
  await page.waitForFunction(()=>document.querySelector('#parkMergeSel25')?.options.length===4);
  assert.equal(await box.locator('#parkMergeSel25 option[value="28"]').count(),1,'hidden empty destinations remain available');
  await box.locator('#parkMergeSel25').selectOption('5');
  await cancelDialog(()=>box.locator('[data-park-admin-action="mergeFromSelect"]').click());
  await search.fill('');await box.locator('[data-park-admin-sort]').selectOption('created-desc');assert.match(await rows.first().innerText(),/İsimsiz Park/);
  await box.locator('[data-park-admin-sort]').selectOption('measurements-desc');assert.match(await rows.first().innerText(),/Göksu/);
  await box.locator('[data-park-admin-menu]>summary').first().click();
  await cancelDialog(()=>box.locator('[data-park-admin-action="rename"]').first().click());
  await cancelDialog(()=>box.locator('[data-park-admin-action="delete"]').first().click());
  await page.evaluate(axe.source);
  const accessibility=await page.evaluate(async()=>{const result=await axe.run(document.getElementById('parkAdminBox'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
  assert.deepEqual(accessibility,[]);
  const panelFits=await box.locator('.dg-parkadmin-actionpanel').first().evaluate(element=>{const rect=element.getBoundingClientRect();return element.scrollWidth<=element.clientWidth+1&&[...element.querySelectorAll('.btn')].every(button=>{const bounds=button.getBoundingClientRect();return !bounds.width||(bounds.left>=rect.left&&bounds.right<=rect.right+1);});});
  assert.equal(panelFits,true,'action controls must remain inside their panel');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  if(process.env.DG_QA_SCREENSHOT_DIR&&[390,1280].includes(width))await box.screenshot({path:join(process.env.DG_QA_SCREENSHOT_DIR,'park-admin-'+width+'.png')});
  await page.evaluate(()=>{document.getElementById('shell').style.display='none';document.getElementById('landing').style.display='block';});
  const chips=await page.locator('.dg-showcase-animation .chip').evaluateAll(elements=>elements.map(element=>{const style=getComputedStyle(element);return{background:style.backgroundColor,shadow:style.boxShadow};}));
  assert.equal(chips.length,3);for(const chip of chips){assert.equal(chip.background,'rgba(0, 0, 0, 0)');assert.equal(chip.shadow,'none');}
  console.log(JSON.stringify({width,creatorVisible:true,searchFocus:true,sorting:true,lazyMergeTargets:true,cancelledMutations:true,accessible:true,transparentReadouts:true}));
  await page.close();
 }
}finally{await browser.close();await server.close();}
