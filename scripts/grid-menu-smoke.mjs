import assert from 'node:assert/strict';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:950},hasTouch:true,serviceWorkers:"block"}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(async()=>{
  await go('map');initMaps();await dgEnsureLulc();const epsg=32636,x=500000,y=4420000;
  const rectangle=(a,b,w,h)=>[[a,b],[a+w,b],[a+w,b+h],[a,b+h],[a,b]].map(([x,y])=>{const p=dgLcUtmInverse(x,y,epsg);return[p.lon,p.lat];});
  PARK_POLY=[rectangle(x,y,100,80).map(([lon,lat])=>[lat,lon])];PARK_HOLES=[];
  DG_LC_LAST={report:{year:2021},result:{cells:[]}};
  for(let row=0;row<8;row++)for(let col=0;col<10;col++){
   const center=dgLcUtmInverse(x+col*10+5,y+row*10+5,epsg);
   DG_LC_LAST.result.cells.push({row,col,epsg,classKey:col<5?'green':'water',areaM2:100,center,quadWgs:rectangle(x+col*10,y+row*10,10,10).slice(0,4)});
  }
  window.__rawGridFixture=JSON.stringify(DG_LC_LAST.result.cells);
  const panel=document.getElementById('parkInfo');panel.style.display='block';panel.innerHTML=DG_PARK_INFO_PANEL_UI.render({name:'Grid fixture',escape:esc,hectares:'0.8',parkIdChip:'',registerRetryMarkup:'',alternateSelector:'',projectOptionsMarkup:'<option value="1">Fixture project</option>'});
  map.fitBounds(PARK_POLY[0]);dgParkMountMenus();dgParkMountMenus();
 });
 await page.waitForFunction(()=>document.getElementById('surfaceMenuBar').contains(document.getElementById('gridBuildBtn')));
 assert.match(await page.locator('#surfaceMenuBar details[data-menu-order="30"] > summary').innerText(),/Grid & Ölçüm noktaları/);
 assert.match(await page.locator('#togWp').locator('..').textContent(),/Ölçüm noktaları/);
 await page.evaluate(()=>dgSetLang('en'));
 await page.waitForFunction(()=>document.querySelector('#surfaceMenuBar details[data-menu-order="30"] > summary').textContent.includes('Measurement Points'));
 await page.evaluate(()=>dgSetLang('tr'));
 await page.waitForFunction(()=>document.querySelector('#surfaceMenuBar details[data-menu-order="30"] > summary').textContent.includes('Ölçüm noktaları'));
 const menu=page.locator('#surfaceMenuBar details[data-menu-order="30"]');await menu.locator(':scope > summary').click();
 const toggle=page.locator('#chkGreenOnly');await toggle.locator("..").click();assert.equal(await toggle.isChecked(),false);assert.equal(await page.evaluate(()=>DG_GREEN_ONLY),false);
 await page.locator('#gridBuildBtn').click();await page.waitForFunction(()=>DG_GRID_SESSION.getCells().length>0&&!document.getElementById('gridBuildBtn').disabled);
 const full=await page.evaluate(()=>({count:DG_GRID_SESSION.getCells().length,epoch:DG_GRID_SESSION.getEpoch(),points:DG_GRID_SESSION.getCells().map(c=>[c.lat,c.lon])}));assert.ok(full.count>0);
 await toggle.locator("..").click();assert.equal(await toggle.isChecked(),true);await page.waitForFunction(()=>DG_GREEN_ONLY&&!document.getElementById('gridBuildBtn').disabled);
 const green=await page.evaluate(()=>({count:DG_GRID_SESSION.getCells().length,epoch:DG_GRID_SESSION.getEpoch(),safe:DG_GRID_SESSION.getCells().every(c=>dgLcUtmForward(c.lat,c.lon,32636).x<500050)}));
 assert.ok(green.count>0&&green.count<=full.count);assert.ok(green.safe);assert.equal(green.epoch,full.epoch+2,'one rebuild advances the build and clear epochs once each');
 await page.locator('#gridBuildBtn').click();await page.waitForFunction(()=>!document.getElementById('gridBuildBtn').disabled);
 assert.equal(await page.locator('#gridSummary').isVisible(),true);
 assert.equal(await page.evaluate(()=>JSON.stringify(DG_LC_LAST.result.cells)===__rawGridFixture),true);
 await menu.locator(':scope > summary').click();const layers=page.locator('#surfaceMenuBar details[data-menu-order="40"]');await layers.locator(':scope > summary').click();
 await page.locator('#togGrid').locator('..').click();assert.equal(await page.evaluate(()=>map.hasLayer(DG_GRID_SESSION.getGridLayer())),false);
 await page.locator('#togGrid').locator('..').click();assert.equal(await page.evaluate(()=>map.hasLayer(DG_GRID_SESSION.getGridLayer())),true);
 await layers.locator('[data-park-action="clearGrid"]').click();assert.equal(await page.evaluate(()=>DG_GRID_SESSION.getCells().length),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:engine.name(),width,relocatedMenuClick:true,greenOnly:true,unrestricted:true,visibility:true,clear:true,rawRasterUnchanged:true}));await page.close();
}}finally{await browser.close();await server.close();}
