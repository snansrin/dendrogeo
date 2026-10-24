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
 const startPoints=[[39.002,32.004],[39.0028,32.010],[39.0026,32.016]],endPoints=[[39.008,32.004],[39.0076,32.010],[39.0074,32.016]];
 for(const p of await mapPositions(startPoints))await page.mouse.click(p.x,p.y);
 await openTools();assert.match(await panel.locator('[data-cut-boundary="0"]').textContent(),/3 nokta/);assert.equal(await panel.locator('[data-cut-action="save"]').isDisabled(),true);assert.equal(await page.locator('.dg-stage-reference[title="Başlangıç · referans 3"]').textContent(),'1.3');
 await panel.locator('[data-cut-boundary="1"]').click();for(const p of await mapPositions(endPoints))await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 await openTools();
 assert.match(await panel.locator('[data-cut-boundary="0"]').textContent(),/3 nokta/);assert.match(await panel.locator('[data-cut-boundary="1"]').textContent(),/3 nokta/);assert.equal(await panel.locator('[data-cut-edit="finish"]').count(),0);
 // Re-place just the beginning; the end and its direction must survive.
 await panel.locator('[data-cut-boundary="0"]').click();await panel.getByText('Nokta işlemleri',{exact:true}).click();await panel.locator('[data-cut-edit="reset"]').click();assert.equal(await panel.locator('[data-cut-action="save"]').isDisabled(),true);assert.match(await panel.locator('[data-cut-boundary="1"]').textContent(),/3 nokta/);
 for(const p of await mapPositions(startPoints))await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 const anchor=page.locator('.dg-stage-reference[title="Bitiş · referans 3"]'),box=await anchor.boundingBox();await page.mouse.move(box.x+22,box.y+22);await page.mouse.down();await page.mouse.move(box.x+14,box.y+28,{steps:5});await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 const preview=await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,anchors:Object.values(map._layers).filter(layer=>layer instanceof L.Marker&&layer.options.draggable).map(layer=>({title:layer.options.title,point:[layer.getLatLng().lat,layer.getLatLng().lng]}))}));
 assert.equal(preview.id,9001);assert.equal(preview.writes,0);assert.equal(preview.anchors.length,6);
 await openTools();assert.equal(await panel.locator('#dgStageCutName').inputValue(),'Kolay bölüm');await panel.locator('#dgStageCutName').fill('Köprüler arası etap');
 await page.addScriptTag({content:axe.source});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document.querySelector('.dg-stage-cut-panel'))).violations.map(v=>v.id)),[]);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(process.env.DG_STAGE_SCREENSHOT_DIR)await page.locator('#dgStageToolsMenu > .dg-editor-menu-body').screenshot({path:join(process.env.DG_STAGE_SCREENSHOT_DIR,'bagimsiz-sinirlar-'+width+'.png')});
 await panel.locator('[data-cut-action="save"]').click();await page.waitForFunction(()=>DG_PARK?.id===9002);
 const saved=await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,geometry:PARK_POLY,name:DG_PARK.name,hint:!!document.querySelector('.dg-stage-map-hint'),panel:!!document.querySelector('.dg-stage-cut-panel')}));
 assert.equal(saved.writes,1);assert.match(saved.name,/Köprüler arası etap/);assert.equal(saved.hint,false);assert.equal(saved.panel,false);
 for(const anchor of preview.anchors)assert.ok(saved.geometry.flat().some(p=>Math.hypot(p[0]-anchor.point[0],p[1]-anchor.point[1])<1e-9),'saved curve retains every user control');
 for(const p of saved.geometry.flat())assert.ok(p[0]>=39-1e-10&&p[0]<=39.01+1e-10&&p[1]>=32-1e-10&&p[1]<=32.02+1e-10);
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
 const beforeHandles=await page.locator('.dg-stage-reference').count(),startHandles=await page.locator('.dg-stage-reference[title^="Başlangıç"]').count(),segments=page.locator('path.dg-stage-cut-segment');
 const segmentIndex=await segments.evaluateAll((paths,count)=>paths.slice(0,count-1).map((path,index)=>({index,length:path.getTotalLength()})).sort((a,b)=>b.length-a.length)[0].index,startHandles);
 await segments.nth(segmentIndex).click();await page.waitForFunction(n=>document.querySelectorAll('.dg-stage-reference').length===n,beforeHandles+1);
 const midpoint=await page.locator('.dg-stage-reference[title="Başlangıç · referans '+(segmentIndex+2)+'"]').boundingBox();await page.mouse.move(midpoint.x+22,midpoint.y+22);await page.mouse.down();await page.mouse.move(midpoint.x+22,midpoint.y+14,{steps:5});await page.mouse.up();await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 await openTools();await panel.locator('[data-cut-boundary="0"]').click();await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);
 assert.match(await panel.locator('[data-cut-boundary="0"]').textContent(),new RegExp((startHandles+1)+' nokta'));assert.equal(await page.locator('.dg-stage-reference').first().textContent(),'1.1');
 assert.deepEqual(await page.evaluate(()=>({active:DG_PARK.id,writes:__stageFixture.writes,old:JSON.stringify(__stageFixture.rows[0])})),{active:9002,writes:1,old:original});
 await panel.locator('#dgStageCutName').fill('Detaylı etap sürümü');await page.addScriptTag({content:axe.source});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document.querySelector('.dg-stage-cut-panel'))).violations.map(v=>v.id)),[]);
 if(process.env.DG_STAGE_SCREENSHOT_DIR)await page.locator('#dgStageToolsMenu > .dg-editor-menu-body').screenshot({path:join(process.env.DG_STAGE_SCREENSHOT_DIR,'etap-duzenleme-'+width+'.png')});
 await panel.locator('[data-cut-action="save"]').click();await page.waitForFunction(()=>DG_PARK?.id===9003);
 const revision=await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,name:DG_PARK.name,old:JSON.stringify(__stageFixture.rows[0]),parentUnchanged:JSON.stringify(DG_PARK_SESSION.get('way/990001'))===JSON.stringify(__stageFixture.parent)}));
 assert.equal(revision.writes,2);assert.match(revision.name,/Detaylı etap sürümü/);assert.equal(revision.old,original);assert.equal(revision.parentUnchanged,true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,upperTools:true,noAutomaticChoice:true,multiPointNewStage:true,saveWithoutFinish:true,previewReadOnly:true,savedStage:saved.id,capEditStage:revision.id,numberedInsertion:true,parentAndOriginalUnchanged:true,errors}));await page.close();
}
 const page=await browser.newPage({viewport:{width:390,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await isolateAccount(page);await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await installStageFixture(page,{outer:[[[39,32],[39,32.02],[39.004,32.02],[39.004,32.006],[39.01,32.006],[39.01,32],[39,32]]],inner:[]});
 await page.evaluate(()=>window.__storedStageSaveSetup=(async()=>{if(!window.polygonClipping)await dgLoadVendorScript('vendor/polygon-clipping-0.15.7.js');const geometry=DG_PARK_STAGE_CUT_GEOMETRY.betweenCuts(__parentCandidate.rings,[[[39.006,32],[39.006,32.02]],[[39.002,32],[39.008,32.02]]],{polygon:polygonClipping,clip:DG_PARK_STAGE_GEOMETRY.clip}).geometry;const {data}=await sb.rpc('dg_create_park_stage',{p_parent:9001,p_name:'Önceden kaydedilmiş etap',p_geometry:geometry});await drawPark(DG_PARK_STAGE_GEOMETRY.candidate(data));})());
 const original=await page.evaluate(()=>JSON.stringify(__stageFixture.rows[0]));await page.locator('#dgStageToolsMenu > summary').click();await page.locator('[data-stage-action="revise"]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-cut-action="save"]').disabled);assert.doesNotMatch(await page.locator('[data-cut-status]').textContent(),/kesişiyor/);
 await page.locator('#dgStageCutName').fill('Kaydedilebilir düzenleme');await page.locator('[data-cut-action="save"]').click();await page.waitForFunction(()=>DG_PARK?.id===9003);
 assert.equal(await page.evaluate(()=>JSON.stringify(__stageFixture.rows[0])),original);assert.equal(await page.evaluate(()=>__stageFixture.writes),2);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({storedConcaveStage:true,outsideCrossingSave:true,originalUnchanged:true,errors}));await page.close();
}finally{await browser.close();await server.close();}
