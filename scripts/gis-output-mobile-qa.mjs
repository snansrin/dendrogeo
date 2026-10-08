#!/usr/bin/env node
/* Real Chromium fixture reproducing the reported mobile map analysis cards.
 * No Supabase requests or GIS analysis; verifies CSS layout and toast stacking.
 */
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,360,390,430]){
  const page=await browser.newPage({viewport:{width,height:840}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(()=>{
   const view=document.getElementById('v-map'),shell=document.getElementById('shell'),landing=document.getElementById('landing');
   const park=document.getElementById('parkInfo'),bar=document.getElementById('surfaceMenuBar');
   if(!view||!park||!bar||!document.getElementById('toastWrap'))return{ready:false};
   if(shell)shell.style.display='block';
   if(landing)landing.style.display='none';
   view.style.display='block';park.style.display='block';
   park.innerHTML='<div class="dg-png-head"><div class="dg-png-title">🌳 Göksu Parkı 50.1 ha</div></div>'+
     '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">'+
     '<div id="parkSurfaceAction" class="dg-png-card"><div class="dg-png-head"><span class="dg-png-title">Arazi örtüsü · 10 m WorldCover 2021</span></div>'+
     '<button class="dg-png-btn primary">🌿 Yüzey Örtüsü Analizi</button>'+
     '<div class="dg-png-sub" style="font-size:.68rem">Park polygonu + 10 m raster (ESA WorldCover 2021 v200 birincil, IO LULC 2020 çapraz) ile coverage-weighted zonal analiz.</div>'+
     '</div></div>'+
     '<div id="landCoverReport" class="dg-png-result"><b>🗺️ Arazi Örtüsü · 10 m · 2021</b>'+
     '<div style="font-size:.67rem;color:var(--mut)">ESA WorldCover 10 m · 2021 (v200) · ✓ geometrik QA geçti (%0.20 fark)</div>'+
     '<div style="margin:6px 0 4px;padding:10px 12px;border:1px solid var(--line);border-radius:12px">'+
     ["🌿 Yeşil alan","💧 Su","🧱 Sert zemin","🟫 Çıplak zemin"].map((label,i)=>
       '<div style="margin:8px 0"><div style="display:flex;align-items:center;gap:8px">'+
       '<div style="flex:0 0 106px;font-size:.75rem;font-weight:700">'+label+'</div>'+
       '<div style="flex:1;height:16px;background:rgba(20,30,25,.06);border-radius:8px;overflow:hidden">'+
       '<div style="height:100%;width:75%;background:#22c55e66"></div></div>'+
       '<div class="mono" style="flex:0 0 108px;text-align:right;font-size:.75rem;font-weight:600">'+
       [22.22,12.50,14.72,0.58][i].toFixed(2)+' ha <span style="color:var(--mut)">%44.4</span></div></div>'+
       '<div style="margin:2px 0 0 114px;font-size:.66rem;color:var(--mut)">3.453 hücre · 🧩 9 nesne · en büyük 19.87 ha</div></div>'
     ).join('')+
     '</div><div style="font-size:.66rem;color:var(--mut)">Park: 50.11 ha · Analiz: 50.01 ha · Hücre: 7.864 · Kapsam: %100.0</div></div>';
   const outer=document.getElementById('surfaceEditorMenu');
   outer.style.display='flex';
   bar.innerHTML='<details class="dg-editor-menu" data-menu-order="20"><summary>Görünüm</summary><div class="dg-editor-menu-body">Harita görünümü</div></details>';
   const toast=document.getElementById('toastWrap');
   toast.innerHTML='<div class="toast warn"><span class="icon">⚠</span><span class="msg">Uzun analiz uyarısı: OSM nesne sınırları yüklenemedi. Su alanını doğrulayın.</span></div>';
   const r=node=>{const b=node.getBoundingClientRect();return{left:b.left,right:b.right,width:b.width,scroll:node.scrollWidth,client:node.clientWidth};};
   const desc=document.querySelector('#parkSurfaceAction>.dg-png-sub:last-child');
   const rep=document.querySelector('#landCoverReport');
   return{
    ready:true,
    width:innerWidth,
    documentWidth:document.documentElement.scrollWidth,
    park:r(park),description:r(desc),report:r(rep),
    rows:[...rep.querySelectorAll('div[style*="display:flex;align-items:center"]')].map(r),
    toastZ:Number(getComputedStyle(toast).zIndex),
    menuZ:Number(getComputedStyle(outer).zIndex),
    toastText:toast.querySelector('.msg')?.innerText
   };
  });
  console.log(JSON.stringify(result));
  if(!result.ready||result.documentWidth>width+1||result.park.right>width+1||
    result.description.right>width+1||result.report.right>width+1||
    result.rows.some(r=>r.right>width+1)||result.toastZ<=result.menuZ||
    errors.length)throw Error('Surface report/toast mobile overflow at '+width+'px '+JSON.stringify(errors));
  await page.close();
 }
}finally{await browser.close();}
