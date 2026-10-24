import assert from 'node:assert/strict';import axe from 'axe-core';
import{serveFixture,isolateAccount}from'./lib/browser-acceptance-fixture.mjs';
import{installStageFixture}from'./lib/park-stage-browser-fixture.mjs';
import{loadChromium}from'./lib/playwright-runtime.mjs';
import{join}from'node:path';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await isolateAccount(page);await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await installStageFixture(page);
 const summary=page.locator('#dgStageToolsMenu > summary'),host=page.locator('#dgParkStageWorkspace');await summary.click();
 const tools=page.locator('#dgStageToolsMenu'),openTools=async()=>{if(!await tools.evaluate(el=>el.open))await summary.click();},closeTools=async()=>{if(await tools.evaluate(el=>el.open))await summary.click();};
 const mapPositions=async points=>{await closeTools();await page.locator('#map').scrollIntoViewIfNeeded();return page.evaluate(points=>{map.stop();map.fitBounds(L.latLngBounds(__parentCandidate.rings.outer),{animate:false,padding:[24,24]});const box=map.getContainer().getBoundingClientRect();return points.map(point=>{const p=map.latLngToContainerPoint(point);return{x:box.left+p.x,y:box.top+p.y};});},points);};
 assert.equal(await host.evaluate(el=>el.closest('#surfaceMenuBar')!==null),true);
 await page.waitForFunction(()=>!document.querySelector('[data-stage-action="edit"]').disabled);
 await host.locator('[data-stage-action="edit"]').click();await host.locator('#dgStageName').fill('Kolay bölüm');
 await host.locator('[data-stage-action="suggest"]').click();await page.waitForFunction(()=>document.querySelectorAll('#dgStageProposal option').length===3);
 assert.equal(await host.locator('#dgStageProposal').inputValue(),'');assert.equal(await host.locator('[data-stage-action="save"]').isDisabled(),true);
 assert.equal(await host.locator('#dgStageName').inputValue(),'Kolay bölüm');
 await host.locator('#dgStageProposal').selectOption('1');
 assert.deepEqual(await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,unchanged:JSON.stringify(PARK_POLY)===JSON.stringify(__parentCandidate.rings.outer)})),{id:9001,writes:0,unchanged:true});
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   assert.equal(await host.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,JSON.stringify(await host.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,overflow:[...el.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>el.getBoundingClientRect().right+1).map(n=>[n.tagName,n.className,n.getBoundingClientRect().width,n.getBoundingClientRect().right-el.getBoundingClientRect().right])}))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }
 if(process.env.DG_STAGE_SCREENSHOT_DIR){await page.evaluate(()=>document.getElementById('toastWrap')?.replaceChildren());await page.locator('#dgStageToolsMenu > .dg-editor-menu-body').evaluate(el=>{el.scrollTop=0;});await page.locator('#dgStageToolsMenu > .dg-editor-menu-body').screenshot({path:join(process.env.DG_STAGE_SCREENSHOT_DIR,'otomatik-etap-'+width+'.png')});}
 await host.locator('[data-stage-action="pick"]').click();await page.locator('#map').scrollIntoViewIfNeeded();
 const panel=page.locator('.dg-stage-cut-panel');await panel.waitFor();
 // Render the real surface rail alongside the stage menu, without creating an
 // analysis or persisting data. This reproduces the reported overlap state.
 await page.evaluate(()=>window.__stageRailSetup=(async()=>{await dgEnsureLulc();const previous=DG_SENS.record;try{DG_SENS.record={features:[],objectFeatures:[],corrections:{},brushHistory:[],period:'ytd',thresholds:{}};dgSensRenderPaintTools();}finally{DG_SENS.record=previous;}})());
 assert.ok(await page.locator('#surfaceMapTools .dg-editor-tool').count()>0);
 await openTools();assert.equal(await panel.evaluate(el=>!!el.closest('#dgStageToolsMenu > .dg-editor-menu-body')),true);assert.equal(await host.isVisible(),false);assert.ok((await panel.boundingBox()).width>=290,'stage controls retain a readable menu width');
 await panel.getByRole('button',{name:'Küçült',exact:true}).click();assert.equal(await panel.locator('.dg-stage-cut-body').isVisible(),false);await panel.getByRole('button',{name:'Sınırları aç',exact:true}).click();
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert.equal(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);const button=panel.locator('[data-cut-boundary="0"]');await button.scrollIntoViewIfNeeded();assert.equal(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),true,'the real toolbar cannot cover the stage button');}
 const referencePoints=[[39.002,32.004],[39.0026,32.016],[39.008,32.004],[39.0074,32.016]],positions=await mapPositions(referencePoints);
 for(const p of positions)await page.mouse.click(p.x,p.y);
 console.log(JSON.stringify(await page.evaluate(()=>({step:'four-references',status:document.getElementById('dgStageStatus')?.textContent,markers:Object.values(map._layers).filter(l=>l instanceof L.Marker).length}))));
 await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 await openTools();
 assert.equal(await panel.locator('[data-cut-boundary="0"]').textContent(),'Başlangıç sınırı · 2/2');assert.equal(await panel.locator('[data-cut-boundary="1"]').textContent(),'Bitiş sınırı · 2/2');
 // Re-place just the beginning; the end and its direction must survive.
 await panel.locator('[data-cut-boundary="0"]').click();assert.equal(await panel.locator('[data-cut-action="save"]').isDisabled(),true);
 for(const p of await mapPositions(referencePoints.slice(0,2)))await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 const anchor=page.locator('.dg-stage-reference[title="Bitiş · referans 2"]'),box=await anchor.boundingBox();await page.mouse.move(box.x+22,box.y+22);await page.mouse.down();await page.mouse.move(box.x+14,box.y+28,{steps:5});await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 const preview=await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,anchors:Object.values(map._layers).filter(layer=>layer instanceof L.Marker&&layer.options.draggable).map(layer=>({title:layer.options.title,point:[layer.getLatLng().lat,layer.getLatLng().lng]}))}));
 assert.equal(preview.id,9001);assert.equal(preview.writes,0);assert.equal(preview.anchors.length,4);
 await openTools();assert.equal(await panel.locator('#dgStageCutName').inputValue(),'Kolay bölüm');await panel.locator('#dgStageCutName').fill('Köprüler arası etap');
 await page.addScriptTag({content:axe.source});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document.querySelector('.dg-stage-cut-panel'))).violations.map(v=>v.id)),[]);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(process.env.DG_STAGE_SCREENSHOT_DIR)await page.locator('#dgStageToolsMenu > .dg-editor-menu-body').screenshot({path:join(process.env.DG_STAGE_SCREENSHOT_DIR,'bagimsiz-sinirlar-'+width+'.png')});
 await panel.locator('[data-cut-action="save"]').click();await page.waitForFunction(()=>DG_PARK?.id===9002);
 const saved=await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,geometry:PARK_POLY,name:DG_PARK.name,hint:!!document.querySelector('.dg-stage-map-hint'),panel:!!document.querySelector('.dg-stage-cut-panel')}));
 assert.equal(saved.writes,1);assert.match(saved.name,/Köprüler arası etap/);assert.equal(saved.hint,false);assert.equal(saved.panel,false);
 const cuts=['Başlangıç','Bitiş'].map(title=>preview.anchors.filter(a=>a.title.startsWith(title)).map(a=>a.point));
 for(let i=0;i<2;i++){const [a,b]=cuts[i],middle=cuts[1-i].reduce((s,p)=>[s[0]+p[0]/2,s[1]+p[1]/2],[0,0]),cross=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),sign=Math.sign(cross(middle));for(const p of saved.geometry.flat())assert.ok(cross(p)*sign>=-1e-10,'saved area follows each independently oriented cut');}
 // Edit only the two recovered caps. Inserting and dragging a numbered point
 // must create a new stage identity, leaving the original and parent untouched.
 await summary.click();assert.equal(await summary.textContent(),'🧩 Etaplar');assert.equal(await host.locator('[data-stage-action="apply"]').textContent(),'Seçili etapta çalış');
 const original=await page.evaluate(()=>JSON.stringify(__stageFixture.rows[0]));
 await host.locator('[data-stage-action="revise"]').click();await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 assert.equal(await host.locator('[data-stage-action="draw"]').count(),0);assert.equal(await host.locator('[data-stage-action="suggest"]').count(),0);
 // Leaflet's logical projection can reach its target before the SVG zoom
 // transition finishes. Click the stable, painted segment, not a future pixel.
 await closeTools();await page.locator('#map').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>!document.querySelector('#map .leaflet-zoom-anim'));
 await page.locator('path.dg-stage-cut-segment').first().click();await page.waitForFunction(()=>document.querySelectorAll('.dg-stage-reference').length===5);
 const midpoint=await page.locator('.dg-stage-reference[title="Başlangıç · referans 2"]').boundingBox();await page.mouse.move(midpoint.x+22,midpoint.y+22);await page.mouse.down();await page.mouse.move(midpoint.x+22,midpoint.y+14,{steps:5});await page.mouse.up();await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 await openTools();await panel.locator('[data-cut-boundary="0"]').click();assert.equal(await panel.locator('[data-cut-action="save"]').isDisabled(),true);await panel.locator('[data-cut-edit="finish"]').click();await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 assert.match(await panel.locator('[data-cut-boundary="0"]').textContent(),/3 nokta/);assert.equal(await page.locator('.dg-stage-reference').first().textContent(),'1.1');
 assert.deepEqual(await page.evaluate(()=>({active:DG_PARK.id,writes:__stageFixture.writes,old:JSON.stringify(__stageFixture.rows[0])})),{active:9002,writes:1,old:original});
 await panel.locator('#dgStageCutName').fill('Detaylı etap sürümü');await page.addScriptTag({content:axe.source});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document.querySelector('.dg-stage-cut-panel'))).violations.map(v=>v.id)),[]);
 if(process.env.DG_STAGE_SCREENSHOT_DIR)await page.locator('#dgStageToolsMenu > .dg-editor-menu-body').screenshot({path:join(process.env.DG_STAGE_SCREENSHOT_DIR,'etap-duzenleme-'+width+'.png')});
 await panel.locator('[data-cut-action="save"]').click();await page.waitForFunction(()=>DG_PARK?.id===9003);
 const revision=await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,name:DG_PARK.name,old:JSON.stringify(__stageFixture.rows[0]),parentUnchanged:JSON.stringify(DG_PARK_SESSION.get('way/990001'))===JSON.stringify(__stageFixture.parent)}));
 assert.equal(revision.writes,2);assert.match(revision.name,/Detaylı etap sürümü/);assert.equal(revision.old,original);assert.equal(revision.parentUnchanged,true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,upperTools:true,noAutomaticChoice:true,fourReferences:true,independentCuts:true,previewReadOnly:true,savedStage:saved.id,capEditStage:revision.id,numberedInsertion:true,parentAndOriginalUnchanged:true,errors}));await page.close();
}}finally{await browser.close();await server.close();}
