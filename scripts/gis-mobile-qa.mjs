#!/usr/bin/env node
/* Real Chromium layout regression, isolated fixture. No GIS data writes. */
import {loadChromium} from './lib/playwright-runtime.mjs';
const chromium=await loadChromium(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,360,390,430,768]){
  const page=await browser.newPage({viewport:{width,height:840}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  const seed=await page.evaluate(()=>{
   const workspace=window.DG_GIS_WORKSPACE_UI,view=document.getElementById('v-map');
   const bar=document.getElementById('surfaceMenuBar'),park=document.getElementById('parkInfo');
   if(!workspace||!view||!bar||!park)return{ready:false};
   const shell=document.getElementById('shell'),landing=document.getElementById('landing');
   if(shell)shell.style.display='block';
   if(landing)landing.style.display='none';
   view.style.display='block';park.style.display='block';
   bar.innerHTML='<details class="dg-editor-menu" data-menu-owner="surface" data-menu-order="20"><summary>Görünüm</summary><div class="dg-editor-menu-body"><div class="dg-editor-panel-head">Harita görünümü</div></div></details>'+
    '<details class="dg-editor-menu" data-menu-owner="surface" data-menu-order="50"><summary>Yüzey fırçası</summary><div class="dg-editor-menu-body">Düzenleme</div></details>';
   park.innerHTML='<div id="parkLayerTools" class="dg-png-card"><div class="dg-png-options"><label class="dg-png-option"><span>Waypoint</span><input type="checkbox" id="togWp"></label></div></div>';
   const list=document.getElementById('liveAnalysis');
   if(list)list.innerHTML='<div class="card"><div class="lbl">En Yaygın 6 Tür</div><button class="dg-png-btn">⬇️ PNG indir</button></div>';
   workspace.sync();
   return{
    ready:true,
    menuLabels:[...bar.children].map(x=>x.querySelector('summary')?.textContent),
    order:[...bar.children].map(x=>Number(x.dataset.menuOrder)),
    exportCardCount:document.querySelectorAll('#parkRasterExport').length,
    outputMenuCount:document.querySelectorAll('.dg-ux-output-menu').length,
    speciesButtonCount:list?.querySelectorAll('button').length??-1,
    toolMenuReady:!!document.getElementById('dgUxMapTools')
   };
  });
  if(!seed.ready||seed.exportCardCount!==0||seed.outputMenuCount!==0||
     seed.speciesButtonCount!==0||!seed.toolMenuReady||
     seed.order.indexOf(50)<0)
    throw Error('GIS placement / singleton regression at '+width+': '+JSON.stringify(seed));
  const menu=page.locator('#surfaceMenuBar > details[data-menu-order="50"]');
  await menu.locator('summary').click();
  await page.waitForTimeout(25); // Let the native <details> toggle event position its panel.
  const geometry=await menu.locator(':scope > .dg-editor-menu-body').evaluate(node=>{
   const r=node.getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewport:innerWidth,width:r.width,scrollWidth:document.documentElement.scrollWidth};
  });
  const didFit=geometry.left>=-1&&geometry.right<=width+1&&geometry.bottom<=841&&geometry.scrollWidth<=width+1;
  console.log(JSON.stringify({width,menus:seed.menuLabels,geometry,didFit,errors:errs}));
  if(!didFit||errs.length)throw Error('GIS mobile panel overflow or browser exception at '+width);
  await page.close();
 }
}finally{await browser.close();}
