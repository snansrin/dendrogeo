import assert from 'node:assert/strict';
import {serveFixture} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/park-panel.css"><link rel="stylesheet" href="/vendor/leaflet-1.9.4.css"><body><div id="surfaceMenuBar"></div><div id="surfaceParkTools"></div><div id="parkInfo"><div id="parkGridTools">Grid</div><div id="parkWaypointTools"><div id="dgWaypointGridActions"></div><div id="dgWaypointEditor"></div></div><div id="parkLayerTools">Katmanlar</div><div id="gridSummary"></div></div><div id="map" style="height:440px"></div><script src="/vendor/leaflet-1.9.4.js"></script><script src="/src/ui/park-menu-ui.js"></script><script src="/src/ui/grid-summary.js"></script><script src="/src/ui/grid-waypoint-layer.js"></script></body></html>`;
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/point-toolbar-fixture',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto(server.url+'/point-toolbar-fixture');
 await page.evaluate(()=>{
  DG_PARK_MENU_UI.mount({document,clearMenus:()=>{},arrangeMenus:()=>DG_PARK_MENU_UI.arrange({document}),translate:s=>s,escape:s=>s});
  window.__gridActions=[];DG_GRID_SUMMARY.render({element:document.getElementById('gridSummary'),size:20,total:4,measured:1,empty:3,selected:1,meta:'',translate:s=>s,translateFormat:(s,v)=>s.replace('{n}',v.n),actions:{createAuto:()=>__gridActions.push('auto'),createManual:()=>__gridActions.push('manual')}});
  window.__map=L.map('map').setView([39.001,32.001],17);window.__rows=[{id:1,project_id:7,wp_id:1,lat:39,lon:32,visited:false,hasMeasurement:false},{id:2,project_id:7,wp_id:2,lat:39.001,lon:32.001,visited:true,hasMeasurement:true}];window.__measured=JSON.stringify(__rows[1]);window.__writes=[];
  window.__layer=DG_GRID_WAYPOINT_LAYER.render({map:__map,rows:__rows,leaflet:L,editable:true,onCreate:async p=>{__writes.push({kind:'insert',...p});return{id:3,project_id:7,wp_id:3,...p,visited:false,hasMeasurement:false};},onSave:async p=>{__writes.push({kind:'edit',...p});}});
 });
 await page.evaluate(()=>{const old=document.getElementById('dgWaypointEditor'),replacement=document.createElement('div');replacement.id=old.id;old.replaceWith(replacement);__layer.dgMountControls();});
 const menu=page.locator('details[data-menu-order="35"]');assert.equal(await menu.locator('summary').textContent(),'Ölçüm noktaları ⌄');
 await menu.locator('summary').click();await menu.locator('[data-grid-summary-action="createAuto"]').click();await menu.locator('[data-grid-summary-action="createManual"]').click();assert.deepEqual(await page.evaluate(()=>__gridActions),['auto','manual']);
 assert.equal(await page.locator('.leaflet-top .dg-png-btn').count(),0,'no detached map toolbar');
 await menu.getByRole('button',{name:'＋ Haritaya nokta ekle',exact:true}).click();
 const point=await page.evaluate(()=>{const p=__map.latLngToContainerPoint([39.0018,32.002]),r=__map.getContainer().getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y};});await page.mouse.click(point.x,point.y);
 await page.waitForFunction(()=>__rows.length===3);assert.equal(await page.locator('.wp-badge2').count(),3);
 const pin=page.locator('.leaflet-marker-icon[title="P3 · düzenlenebilir"]'),box=await pin.boundingBox();await page.mouse.move(box.x+14,box.y+14);await page.mouse.down();await page.mouse.move(box.x+35,box.y+26,{steps:6});await page.mouse.up();await page.waitForFunction(()=>__writes.some(w=>w.kind==='edit'));
 await pin.click();await page.getByRole('spinbutton',{name:'Nokta numarası'}).fill('12');await page.getByRole('button',{name:'Kaydet',exact:true}).click();await page.waitForFunction(()=>__rows[2].wp_id===12);
 await menu.locator('summary').click();await menu.getByRole('button',{name:'＋ Haritaya nokta ekle',exact:true}).click();await page.keyboard.press('Escape');await page.mouse.click(point.x-30,point.y+20);
 assert.equal(await page.evaluate(()=>__rows.length),3,'Escape cancels adding without inserting a point');
 assert.equal(await page.evaluate(()=>JSON.stringify(__rows[1])===__measured),true,'measured row is byte-for-byte fixed');
 assert.equal(await page.evaluate(()=>__layer.getLayers().find(m=>m.options.title.startsWith('P2')).dragging.enabled()),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:process.env.DG_UI_BROWSER||'chromium',width,separateToolbar:true,gridActions:true,freePlacement:true,drag:true,renumber:true,measuredUnchanged:true}));await page.close();
}}finally{await browser.close();await server.close();}
