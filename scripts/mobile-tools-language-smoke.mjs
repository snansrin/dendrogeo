import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serveFixture} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const chromium=await loadChromium();
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const server=await serveFixture(),browser=await engine.launch({headless:true});
const paths=['vendor/leaflet-1.9.4.js','src/config/i18n-en.js','src/config/i18n.js','src/ui/record-item.js','src/ui/record-project.js','src/ui/measurement-project-card.js','src/ui/render-measurement-project-directory.js','src/ui/gis-workspace-analysis-layout.js','src/ui/gis-workspace-menu-position.js','src/ui/gis-workspace-map-tools-view.js','src/ui/gis-workspace.js'];
const shell=readFileSync('partials/shell.html','utf8');
const projects=shell.slice(shell.indexOf('<div class="view" id="v-projects">'),shell.indexOf('<div class="view" id="v-records">'));
const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/vendor/leaflet-1.9.4.css"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/gis-workspace.css"><style>body{margin:0}.view{display:block!important;animation:none!important}#map{height:500px}#surfaceMenuBar{position:relative}#liveAnalysis{display:none}#records{padding:10px}#v-map{padding:0!important}#v-projects{padding:12px}.dg-editor-menu-body{background:var(--bg,#fff)}#tail{height:900px}</style><div id="v-map"><div id="surfaceMenuBar"><details class="dg-editor-menu" data-menu-order="20"><summary>Görünüm</summary><div class="dg-editor-menu-body"></div></details><details class="dg-editor-menu" data-menu-order="50"><summary>Yüzey fırçası</summary><div class="dg-editor-menu-body"><button data-dg-click="brushToggle" onclick="DG_LC_SENS.state.brush={}">Fırçayı aç</button></div></details></div><div id="parkInfo"></div><div id="liveAnalysis"></div><div id="map"></div></div><div id="records"></div><div id="cards"></div>${projects}<div id="tail"></div>${paths.map(p=>'<script src="/'+p+'"></script>').join('')}<script>
const map=L.map('map').setView([39.99,32.65],18),PARK_POLY=[[39.98,32.64],[39.98,32.66],[40,32.66]];
window.DG_LC_SENS={state:{}};window.stops=0;function dgSensBrushStop(){stops++;DG_LC_SENS.state.brush=null}
const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const rows=[{id:1,point_id:35,species:'Karaçam',grp:'İBRELİ',status:'Onaylı',girth_cm:80,dbh_cm:80/Math.PI,height_m:12,carbon_kg:34},{id:2,point_id:46,species:'Meşe',grp:'YAPRAKLI',status:'Beklemede',height_m:10,carbon_kg:40}];
function renderRecords(){document.getElementById('records').innerHTML=DG_RECORD_PROJECT_UI.render('Ölçüm',rows,{escape,renderItem:row=>DG_RECORD_ITEM_UI.render(row,{escape,thumbnail:()=>'',statusMeta:s=>({label:s,cls:'on'})})});}
function renderCards(){document.getElementById('cards').innerHTML=[false,true].map(shared=>DG_MEASUREMENT_PROJECT_CARD.render({id:7,name:'Ölçüm',park_id:25,parks:{name:'Göksu Parkı',area_m2:500000},city:'Ankara',country:'Türkiye',created_at:'2026-10-14'},shared,{escape,formatArea:()=> '50 ha',isAdmin:()=>false})).join('')}
renderRecords();renderCards();
</script>`;
try{for(const width of [360,390,430]){
 const context=await browser.newContext({viewport:{width,height:840},hasTouch:true,isMobile:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/fixture',route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.goto(server.url+'/fixture');
 const menu=page.locator('[data-menu-order="20"]');await menu.locator('summary').tap();
 await page.locator('[data-tool="distance"]').tap();
 assert.equal(await menu.getAttribute('open'),null,'tool selection must release the phone map');
 const box=await page.locator('#map').boundingBox();
 for(const [x,y] of [[80,180],[170,240],[240,310]])await page.touchscreen.tap(x,box.y+y);
 await page.waitForFunction(()=>document.getElementById('dgUxMapStatus').textContent.startsWith('3 köşe'));
 // Dragging must not append a measurement vertex; the next tap must work.
 await page.mouse.move(100,box.y+350);await page.mouse.down();await page.mouse.move(180,box.y+390,{steps:8});await page.mouse.up();
 await page.touchscreen.tap(210,box.y+350);
 await page.waitForFunction(()=>document.getElementById('dgUxMapStatus').textContent.startsWith('4 köşe'));
 await page.evaluate(()=>dgSetLang('en'));
 await page.waitForFunction(()=>document.querySelector('.record-project small').textContent==='2 records · 1 approved · 1 pending');
 assert.match(await page.locator('#dgUxMapStatus').textContent(),/^4 vertices · Distance:/);
 assert.equal(await page.locator('.record-project-title b').textContent(),'Ölçüm','user project name must not be translated');
 assert.match(await page.locator('[data-record-action="edit"]').first().getAttribute('aria-label'),/^Edit record P35$/);
 await page.evaluate(()=>{renderRecords();renderCards();const node=document.createElement('button');node.id='dynamic';node.textContent='Sil';node.setAttribute('aria-label','Düzenle');document.body.append(node)});
 await page.waitForFunction(()=>document.getElementById('dynamic').textContent==='Delete');
 assert.equal(await page.locator('#dynamic').getAttribute('aria-label'),'Edit','attributes on inserted roots must translate');
 await page.evaluate(()=>{document.getElementById('dynamic').firstChild.nodeValue='Düzenle'});
 await page.waitForFunction(()=>document.getElementById('dynamic').textContent==='Edit');
 await page.evaluate(()=>{const select=document.createElement('select');select.id='mProject';document.body.append(select);DG_MEASUREMENT_PROJECT_DIRECTORY_UI.render({projects:[{id:1,name:'Sil',park_id:25},{id:2,name:'Ölçüm',park_id:null}],element:id=>document.getElementById(id),escape,optionLabel:p=>p.park_id?p.name:'⛔ '+p.name+' (park yok)',restore(){},renderCard(){return ''},editing:false});});
 await page.waitForFunction(()=>document.querySelector('#mProject option[value="2"]').textContent==='⛔ Ölçüm (no park)');
 assert.equal(await page.locator('#mProject option[value="1"]').textContent(),'Sil');
 const untranslated=await page.locator('#v-projects').evaluate(root=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),out=[];let n;while(n=walker.nextNode())if(/[çğıöşüİ]/.test(n.textContent)&&!n.parentElement.closest('[translate="no"],script,style'))out.push(n.textContent.trim());return out.filter(Boolean)});
 assert.deepEqual(untranslated,[],'project UI must be translated');
 await page.evaluate(()=>dgSetLang('tr'));await page.waitForFunction(()=>document.querySelector('.record-project small').textContent==='2 kayıt · 1 onaylı · 1 bekliyor');
 // Painting from a toolbar must dismiss the picker, and measurement releases it.
 const brush=page.locator('[data-menu-order="50"]');await brush.locator('summary').tap();await brush.locator('button').tap();await page.waitForFunction(()=>!document.querySelector('[data-menu-order="50"]').open);
 assert.equal(await page.locator('[data-tool="distance"]').getAttribute('aria-pressed'),'false','editing must release the distance tool');
 await page.evaluate(()=>DG_GIS_WORKSPACE_UI.activateTool('area'));assert.equal(await page.evaluate(()=>stops),1);
 const b=await page.locator('#map').boundingBox();for(const [x,y] of [[80,160],[170,200],[220,300]])await page.touchscreen.tap(x,b.y+y);
 await page.waitForFunction(()=>document.getElementById('dgUxMapStatus').textContent.startsWith('3 köşe · Alan:'));
 await page.evaluate(()=>DG_GIS_WORKSPACE_UI.closeTool());assert.equal(await page.locator('[data-tool="area"]').getAttribute('aria-pressed'),'false');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Detect remaining Turkish labels across every static application view.
 const translations=await context.newPage();await translations.route('**/static-language',r=>r.fulfill({contentType:'text/html',body:'<meta charset="utf-8">'+shell+paths.filter(p=>p.includes('i18n')).map(p=>'<script src="/'+p+'"></script>').join('')}));await translations.goto(server.url+'/static-language');
 const missing=await translations.evaluate(()=>{dgSetLang('en');const out=[];for(const view of document.querySelectorAll('.view')){const walker=document.createTreeWalker(view,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const s=n.textContent.trim();if(/[çğıöşüİ]/.test(s)&&!n.parentElement.closest('[translate="no"],script,style,textarea'))out.push(view.id+': '+s)}}return out});assert.deepEqual(missing,[]);await translations.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:process.env.DG_UI_BROWSER||'chromium',width,touchDistance:true,touchArea:true,panThenTap:true,brushMenu:true,bilingualRecords:true,bilingualProjects:true,allStaticViews:true,rawNames:true}));await context.close();
}}finally{await browser.close();await server.close();}
