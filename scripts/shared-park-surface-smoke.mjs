import assert from 'node:assert/strict';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
const server=await serveFixture(),chromium=await loadChromium();
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await isolateAccount(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(async()=>{
  await loadProjects();await dgInvitesLoadMine();await dgCollabLoad();await go('map');initMaps();
  window.__leaveCalls=[];const originalRpc=sb.rpc;
  sb.rpc=(name,params)=>{if(name==='dg_leave_park'){window.__leaveCalls.push(params);return Promise.resolve({data:true,error:null});}return originalRpc(name,params);};
  const outer=[[[39.99,32.62],[39.99,32.621],[39.991,32.621],[39.991,32.62],[39.99,32.62]]];
  const coordinates=[outer.map(ring=>ring.map(([lat,lon])=>[lon,lat]))];
  window.__savedSurface={schema:'dendrogeo-surface/2',parkId:25,outer,holes:[],acceptedAt:'2026-10-16T10:00:00Z',areas:{green:10000,building:100},features:[{type:'Feature',geometry:{type:'MultiPolygon',coordinates},properties:{class:'green',area_m2:10000}}]};
  sb.rpc=(previous=>((name,params)=>name==='dg_accepted_park_surface'?Promise.resolve({data:{result:window.__savedSurface},error:null}):previous(name,params)))(sb.rpc);
  const info=document.getElementById('parkInfo');info.style.display='block';info.innerHTML=DG_PARK_INFO_PANEL_UI.render({name:'Fixture Park',escape:esc,hectares:'1',parkIdChip:'',registerRetryMarkup:'',alternateSelector:'',projectOptionsMarkup:''});
  map.fitBounds(outer[0]);await DG_ACCEPTED_PARK_SURFACE.show({parkId:25,outer,holes:[],host:document.getElementById('acceptedParkSurface'),isCurrent:()=>true});
 });
 assert.equal(await page.locator('#acceptedParkSurface').isVisible(),true);
 assert.match(await page.locator('#acceptedParkSurface').innerText(),/Kayıtlı park haritası/);
 assert.equal(await page.evaluate(()=>{let count=0;map.eachLayer(layer=>{if(layer.feature?.properties?.class==='green'){count++;if(layer.options.interactive)throw Error('Saved layer must be read-only');}});return count;}),1);
 await page.evaluate(()=>DG_ACCEPTED_PARK_SURFACE.clear());assert.equal(await page.locator('#acceptedParkSurface').isVisible(),false);
 assert.equal(await page.evaluate(()=>{let count=0;map.eachLayer(layer=>{if(layer.feature)count++;});return count;}),0);
 await page.locator('#side [data-dg-view="projects"]').click();
 await page.evaluate(()=>{
  PROJ_LIST=[{id:72,shared:true,park_id:25,name:'Fixture shared project',parks:{name:'Fixture park'}}];
  DG_MEASUREMENT_PROJECT_DIRECTORY_UI.render({projects:PROJ_LIST,element:$,escape:esc,optionLabel:p=>p.name,restore(){},renderCard:dgProjectCard,editing:false,actions:{leave:dgParkLeaveProject}});
 });
 const shared=page.locator('#projSharedList .project-card');await shared.locator('summary').click();
 page.once('dialog',dialog=>dialog.dismiss());await shared.locator('[data-project-action="leave"]').click();assert.equal(await page.evaluate(()=>__leaveCalls.length),0);
 page.once('dialog',dialog=>dialog.accept());await shared.locator('[data-project-action="leave"]').click();await page.waitForFunction(()=>__leaveCalls.length===1);await page.locator('#projSharedSection').waitFor({state:'hidden'});
 assert.deepEqual(await page.evaluate(()=>__leaveCalls),[{p_park:25}]);
 const tileLevels=[];await page.route('https://server.arcgisonline.com/**',route=>{
  const zoom=Number(new URL(route.request().url()).pathname.match(/\/tile\/(\d+)/)?.[1]);
  tileLevels.push(zoom);return zoom>=20?route.fulfill({status:404,body:''}):route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU4cAAAAASUVORK5CYII=','base64')});
 });
 await page.locator('#side [data-dg-view="map"]').click();
 await page.evaluate(()=>{switchBaseLayer('sat');map.setView([39.99,32.62],20);});
 await page.waitForFunction(()=>{let fallback=false;map.eachLayer(layer=>{if(layer._dgBase==='sat'&&layer.options.maxNativeZoom===19)fallback=true;});return fallback;});
 assert.equal(await page.evaluate(()=>map.getMaxZoom()),22);
 await page.evaluate(()=>map.setZoom(22));await page.waitForFunction(()=>map.getZoom()===22);assert.equal(await page.evaluate(()=>map.getZoom()),22,'native tile fallback preserves the requested zoom');
 await page.waitForFunction(()=>document.querySelector('#map .leaflet-control-zoom-in').getAttribute('aria-disabled')==='true');
 const nativeLevels=await page.evaluate(()=>Object.values(map._layers).filter(layer=>layer._dgBase==='sat').map(layer=>layer._tileZoom));
 assert.deepEqual(nativeLevels,[19]);assert.ok(tileLevels.every(level=>level<=19),'historical imagery never requests unavailable higher levels');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:engine.name(),width,savedMapReadOnly:true,analysisClearsSavedLayer:true,leaveCancel:true,leaveRpcSelfOnly:true,sharedListRefresh:true,imageryFallback:true}));await page.close();
}}finally{await browser.close();await server.close();}
