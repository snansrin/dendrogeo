import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
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
  const arrowState=async open=>page.waitForFunction(({element,open})=>{
   const matrix=new DOMMatrix(getComputedStyle(element,'::after').transform);
   return open?matrix.a<-.6&&matrix.b<-.6:matrix.a>.6&&matrix.b>.6;
  },{element:await summary.elementHandle(),open},{timeout:5000});
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
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,tabs:await tabs.count(),disclosures,buttons,cardContained:true,bilingual:true,noPageErrors:true}));
 await page.close();
}}finally{await browser.close();await server.close();}
