import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';

const server=await serveFixture(),chromium=await loadChromium();
const browserType=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const browser=await browserType.launch({headless:true});
const output=join(tmpdir(),'dendrogeo-ui-consistency');mkdirSync(output,{recursive:true});
try{for(const width of [320,360,390,430,768,1280]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await isolateAccount(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.locator('#shell').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(()=>{
  PROFILE.role='owner';for(const id of ['miAdmin','miUsers','miVisitors'])document.getElementById(id).style.display='';
  PROJ_LIST=[{id:1,park_id:36,name:'Gençlik Parkı araştırma projesi',owner:USER.id,parks:{name:'Gençlik Parkı',area_m2:258000}}];
  document.getElementById('mProject').innerHTML='<option value="1">Gençlik Parkı araştırma projesi</option>';
 });
 let disclosures=0,buttons=0;
 const disclosure=async node=>{
  const summary=node.locator(':scope > summary');if(!await summary.isVisible())return;
  // GitHub's shared runner can pause animation frames when heavy GIS smoke
  // checks precede this UI probe. Verify the same end-state (never bypass it),
  // with a bounded 12s transition allowance and useful failure diagnostics.
  const arrowState=async open=>{
   const element=await summary.elementHandle();
   try{
    await page.waitForFunction(({element,open})=>{
     const matrix=new DOMMatrix(getComputedStyle(element,'::after').transform);
     return open?matrix.a<-.6&&matrix.b<-.6:matrix.a>.6&&matrix.b>.6;
    },{element,open},{timeout:12000});
   }catch(error){
    const observed=await summary.evaluate(el=>({
     transform:getComputedStyle(el,'::after').transform,
     expanded:el.parentElement?.hasAttribute('open')||false
    })).catch(()=>({transform:'detached',expanded:null}));
    throw new Error('Disclosure arrow end-state timeout (width='+width+', open='+open+
     ', observed='+JSON.stringify(observed)+')',{cause:error});
   }finally{await element?.dispose();}
  };
  if(await node.getAttribute('open')!==null)await summary.click();
  await arrowState(false);
  const closed=await summary.evaluate(e=>getComputedStyle(e,'::after').transform);
  await summary.click();await arrowState(true);
  assert.notEqual(await node.getAttribute('open'),null);
  const style=await summary.evaluate(e=>({height:e.getBoundingClientRect().height,arrow:getComputedStyle(e,'::after').transform,content:getComputedStyle(e,'::after').content,font:getComputedStyle(e).fontFamily}));
  assert.ok(style.height>=43.5,'touch disclosure height');
  assert.notEqual(style.arrow,closed,'disclosure arrow must follow open state');
  assert.match(style.font,/Manrope/);
  assert.equal(style.content,'""','one shared CSS chevron, not mixed text glyphs');
  const children=node.locator('details');
  for(let i=0;i<await children.count();i++)if(await children.nth(i).isVisible())await disclosure(children.nth(i));
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await node.getAttribute('open'),null,'keyboard closes disclosure');
  assert.equal(await summary.evaluate(e=>e.matches(':focus-visible')&&getComputedStyle(e).outlineStyle!=='none'),true);
  disclosures++;
 };
 const auditView=async selector=>{
  const view=page.locator(selector),details=view.locator('details');
  for(let i=0;i<await details.count();i++)if(await details.nth(i).isVisible())await disclosure(details.nth(i));
  const bad=await view.locator('button').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).flatMap(e=>{
   const s=getComputedStyle(e),r=e.getBoundingClientRect();
   return !((e.textContent||e.getAttribute('aria-label')||e.title||'').trim())||!s.fontFamily.includes('Manrope')||r.height<43.5?[{id:e.id,text:e.textContent.trim(),font:s.fontFamily,height:r.height}]:[];
  }));
  buttons+=await view.locator('button:visible').count();
  assert.deepEqual(bad,[],selector+' button theme/touch targets');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,selector+' page overflow');
 };
 const tabs=page.locator('#side [data-dg-view]');
 for(let i=0;i<await tabs.count();i++){
  const tab=tabs.nth(i),id=await tab.getAttribute('data-dg-view');
  await tab.click();await page.locator('#v-'+id+'.on').waitFor({state:'visible'});
  await auditView('#v-'+id);
  if(id==='admin'){
   await page.addScriptTag({url:new URL('/src/ui/photo-admin-controls.mjs',page.url()).href});
   await page.evaluate(()=>window.DG_PHOTO_ARCHIVE_UI.mount());
   const actions=page.locator('#v-admin .admin-storage-actions');
   assert.equal(await actions.count(),2,'maintenance and backups have separate named groups');
   assert.equal(await actions.nth(1).locator('#dgPhotoArchiveAdminDownload').count(),1,'ZIP stays in backup group');
   for(const theme of ['light','dark']){
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    for(const group of await actions.all()){
     const layout=await group.evaluate(el=>{const r=el.getBoundingClientRect();const buttons=[...el.querySelectorAll('.btn')].map(b=>{const x=b.getBoundingClientRect();return {left:x.left,right:x.right,top:x.top,bottom:x.bottom};});return {gap:parseFloat(getComputedStyle(el).gap),contained:buttons.every(b=>b.left>=r.left-1&&b.right<=r.right+1),overlap:buttons.some((a,i)=>buttons.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top))};});
     assert.ok(layout.gap>=8,'buttons have a theme-consistent gap');
     assert.equal(layout.contained,true,'buttons stay inside their group');
     assert.equal(layout.overlap,false,'admin action buttons never touch or overlap');
    }
    await auditView('#v-admin');
    await actions.nth(1).locator('..').locator('..').screenshot({path:join(output,'admin-storage-'+theme+'-'+width+'.png')});
   }
   await page.evaluate(()=>delete document.documentElement.dataset.theme);
  }

 }
 await page.locator('#side [data-dg-view="map"]').click();
 await page.evaluate(()=>{
  const host=document.getElementById('parkInfo');host.style.display='block';
  host.innerHTML=DG_PARK_INFO_PANEL_UI.render({name:'Gençlik Parkı',escape:x=>String(x),hectares:'25.8',parkIdChip:'<span class="dg-png-badge">kimlik #36 · OSM</span>',registerRetryMarkup:'',alternateSelector:'',projectOptionsMarkup:'<option value="1">Gençlik Parkı araştırma projesi</option>'});
  document.getElementById('liveAnalysis').innerHTML='<div class="card"><div class="lbl">En Yaygın 6 Tür</div><div><div><span>Test türü</span></div></div></div>';
  DG_GIS_WORKSPACE_UI.sync();
 });
 await page.waitForTimeout(150);
 for(const language of ['tr','en']){
  if(language==='en')await page.locator('#apptop .dg-lang-toggle').click();
  const panel=await page.locator('#parkSurfaceAction').evaluate(e=>{
   const r=e.getBoundingClientRect();
   return{contained:[...e.querySelectorAll('*')].every(n=>{const b=n.getBoundingClientRect();return !b.width||(b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1);}),
    buttonColor:getComputedStyle(e.querySelector('button')).backgroundColor,
    themeColor:getComputedStyle(document.querySelector('.btn:not(.ghost):not(.blue):not(.red):not(.amber)')).backgroundColor};
  });
  assert.equal(panel.contained,true,'park analysis content must stay inside its card: '+width+' '+language);
  assert.equal(panel.buttonColor,panel.themeColor,'analysis and app primary buttons share a theme');
  await auditView('#v-map');
 }
 await page.locator('#parkSurfaceAction').screenshot({path:join(output,'park-analysis-'+width+'.png')});
 // The app brand returns to the dashboard, preserving session and unsaved input.
 const beforeBrand=await page.evaluate(()=>{
  window.__brandLogoutCalls=0;window.logout=()=>{__brandLogoutCalls++;};
  document.getElementById('mDbh').value='110';
  return {user:USER.id,url:location.href};
 });
 for(const keyboard of [false,true]){
  await page.locator('#side [data-dg-view="records"]').click();
  const brand=page.locator('#apptop .logo');
  if(keyboard){await brand.focus();await page.keyboard.press('Enter');}else await brand.locator('img').click();
  await page.locator('#v-dash.on').waitFor({state:'visible'});
  assert.equal(await page.locator('#shell').isVisible(),true);
  assert.equal(await page.locator('#landing').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>({user:USER.id,url:location.href})),beforeBrand);
  assert.equal(await page.locator('#mDbh').inputValue(),'110');
  assert.equal(await page.evaluate(()=>__brandLogoutCalls),0,'brand must not invoke sign-out');
 }
 await page.locator('[data-dg-chrome-action="logout"]').click();
 assert.equal(await page.evaluate(()=>__brandLogoutCalls),1,'only the explicit exit button invokes sign-out');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,tabs:await tabs.count(),disclosures,buttons,cardContained:true,bilingual:true,noPageErrors:true}));
 await page.close();
}}finally{await browser.close();await server.close();}
