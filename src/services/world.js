"use strict";
/* 0035c: EN modu için kısa çeviri yardımcısı (i18n yoksa TR döner). */
const _tw=(s)=>(typeof dgT==="function"?dgT(s):s);
/* ============ PARK KARŞILAŞTIRMA + RAPOR ============
 * 2026-09-24 DEĞİŞİKLİK (kullanıcı isteği): bu liste artık PROJELERE VERİLEN
 * ADLARI değil, ALGILANAN PARKLARI gösterir. 3 kişi Göksu Parkı'nda çalıştıysa
 * üç proje satırı değil TEK "Göksu Parkı" satırı çıkar; kayıt/karbon/katılımcı
 * sayıları o parkta birleşir.
 *
 * Kaynak: public.v_park_compare (0004_parks.sql). View park bazında GROUP BY
 * yaptığı için iki eski sorun da biter:
 *   · istemcide .limit(5000) ile ham satır çekip toplama → kesilme riski yok,
 *     satır sayısı park sayısıyla sınırlı (bkz. utils/truncation.js gerekçesi),
 *   · proje adı değişince sıralamanın değişmesi → kimlik artık OSM elemanı.
 *
 * Park bağı olmayan ESKİ projeler kaybolmaz: park_id=0 + park_pending=true
 * ile ayrı, sıralamaya karışmayan bir bölümde listelenir. Yönetim →
 * "🌳 Parkları Geri Doldur" aracı bunları ölçüm merkezinden OSM parkıyla
 * eşleştirip ana listeye taşır. */
let PARK_DATA=[];   /* seçili parkın ham ölçüm satırları (rapor için) */
let PARK_ROWS=[];   /* v_park_compare satırları */
const DG_WORLD_PARK_COMPARISON_MODULE_STORE=window.DG_WORLD_PARK_COMPARISON_STORE.create(()=>sb);

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadParkCompare(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadParkCompare__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadParkCompare__scroll(){
 return window.DG_LOAD_PARK_COMPARISON.execute({
  read:()=>DG_WORLD_PARK_COMPARISON_MODULE_STORE.primary(),
  resolve:error=>window.DG_RESOLVE_PARK_COMPARISON_READ.resolve(error,dgIsSchemaError),
  onDenied:dgParkCompareDenied,
  onSchemaMissing:error=>dgParkSchemaMissing("v_park_compare: "+error.message),
  loadLegacy:()=>loadParkCompareLegacy(),
  render:rows=>window.DG_RENDER_PRIMARY_PARK_COMPARISON.render(rows,{
   setRows:value=>{PARK_ROWS=value;},
   prepare:value=>window.DG_PREPARE_PARK_COMPARISON.prepare(value),
   element:$("parkCompare"),
   renderLinked:(linked,max)=>linked.map((park,index)=>dgParkRowHTML(park,index,max)).join(""),
   renderPending:dgPendingParksHTML,
   renderReportOptions:dgFillReportOptions
  })
 });
}

/* Karşılaştırma satırı — MOBİL UYUMLU (2026-09-24): eskiden tümü satır içi
 * stildi, bu yüzden dar ekranda eziliyordu ve media query ile düzeltilemiyordu.
 * Artık sınıflarla çiziliyor; css/style.css .dg-cmp-* kuralları 640px altında
 * bar'ı alta alıyor, metni sarmalıyor. */
function dgParkRowHTML(p,i,max){
 /* CSS contract in the extracted renderer: class="dg-cmp-row, dg-cmp-main, dg-cmp-bar. */
 return window.DG_PARK_COMPARISON_ROW.render(p,i,max,{escape:esc,translate:_tw,formatHa:dgFmtHa});
}

function dgPendingParksHTML(pending){
 /* Locked source contract: PARK ALGILANMAMIŞ KAYITLAR; const admin=(typeof dgIsAdmin==="function")?dgIsAdmin():false;
  * admin?`<button class="btn sm ghost dg-pend-act" onclick="startParkScan({returnTo:'world'})";
  * normal users see "🔐 yönetici bağlayacak" and never get the scan action. */
 return window.DG_PARK_COMPARISON_PENDING.render(pending,{isAdmin:typeof dgIsAdmin==="function"&&dgIsAdmin(),escape:esc});
}

function dgFillReportOptions(linked,pending){
 window.DG_PARK_REPORT_OPTIONS_UI.render($("repProject"),linked,pending,esc);
}

/* YETKİ/AĞ HATASI — şema bayrağına dokunmaz (2026-09-26).
 * dgParkSchemaMissing'in aksine DG_PARK_SCHEMA_OK=false YAPMAZ: ölçüm kapısı
 * ve park_id yazımı açık kalır. Kullanıcıya gerçek sebep söylenir. */
/* 0040: kaydırma koruma sarmalı. */
function dgParkCompareDenied(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgParkCompareDenied__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgParkCompareDenied__scroll(error){
 return window.DG_SHOW_PARK_COMPARISON_DENIED.show(error,{
  isAdmin:()=>typeof dgIsAdmin==="function"&&dgIsAdmin(),
  log:(code,message)=>console.warn("DENDROGEO · park karşılaştırma okunamadı (şema değil, yetki/ağ):",code,message),
  getElement:()=>$("parkCompare"),render:window.DG_PARK_COMPARISON_ERROR_UI.render,escape:esc,
  toast,translate:dgCf
 });
}

/* Şema eskiyse (migration 0004 uygulanmamış) karşılaştırma proje bazlı eski
 * davranışa düşer — sayfa boş kalmasın, ama kullanıcı sebebini bilsin. */
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadParkCompareLegacy(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadParkCompareLegacy__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadParkCompareLegacy__scroll(){
 const result=await window.DG_LOAD_LEGACY_PARK_COMPARISON.execute({
  load:()=>DG_WORLD_PARK_COMPARISON_MODULE_STORE.legacy(),
  warnIfTruncated:dgWarnIfTruncated,
  setRows:rows=>{PARK_DATA=rows;},
  group:rows=>window.DG_GROUP_LEGACY_PARK_COMPARISON.group(rows)
 });
 const grouped=result.grouped;if(!grouped)return result;
 window.DG_LEGACY_PARK_COMPARISON_UI.renderInto($("parkCompare"),grouped.parks,grouped.max,{escape:esc,translate:_tw});
 window.DG_LEGACY_PARK_COMPARISON_UI.renderOptions($("repProject"),grouped.parks,esc);
 return result;
}

/* Park raporu: seçili PARKIN tüm ölçümleri (tüm kullanıcılar, tüm projeler).
 * park_id>0 → projects.park_id filtresi (PostgREST !inner); park yoksa eski
 * davranış: proje adına göre. */
async function parkReport(){
 const key=$("repProject").value;
 /* Query contract retained in domain request modules: projects!inner( and .eq("projects.park_id",row.park_id). */
 return window.DG_LOAD_PARK_REPORT.run({key,parkRows:PARK_ROWS,
  load:(primary,legacy)=>window.DG_PARK_REPORT_STORE.load(sb,primary,legacy),
  warnIfTruncated:dgWarnIfTruncated,render:dgRenderParkReport,
  onNoSelection:()=>toast("Park seç","err"),
  onError:error=>toast(dgCf("Rapor alınamadı: ")+esc(error.message),"err")});
}

function dgRenderParkReport(name,rows,count,row){
 PARK_DATA=rows;
 if(!rows.length)return toast("Bu park için onaylı kayıt yok.");
 const model=window.DG_SUMMARIZE_PARK_REPORT.summarize(rows,row,count);
 const today=new Date().toLocaleDateString("tr-TR");
 const html=window.DG_PARK_REPORT_SUMMARY_UI.render(name,model,{escape:esc,translate:_tw,formatHa:dgFmtHa,date:today})+
  window.DG_PARK_REPORT_SPECIES_TABLE.render(model.species,LATIN);
 const csv=window.DG_BUILD_PARK_REPORT_CSV.build(name,model,{date:today,latin:LATIN});
 window.DG_PARK_REPORT_PREVIEW_UI.show({title:"📄 "+name+" — "+_tw("Park Raporu"),body:html,csv,
  fileName:name.replace(/\s+/g,"_")+"_rapor.csv",elements:{title:$("pvTitle"),body:$("pvBody"),download:$("pvDownload"),modal:$("previewModal")},download:dl});
}
/* Click-to-zoom */
async function zoomToCountry(country){
 const m=worldMapL||worldMap;if(!m)return;
 return window.DG_WORLD_ZOOM_TO_LOCATION.run(m,"country",country,country,"🌍",{load:(column,value)=>DG_WORLD_PARK_COMPARISON_MODULE_STORE.location(column,value),warnIfTruncated:dgWarnIfTruncated,fit:fitRows});
}
async function zoomToCity(city){
 const m=worldMapL||worldMap;if(!m)return;
 return window.DG_WORLD_ZOOM_TO_LOCATION.run(m,"city",city,city,"🏙",{load:(column,value)=>DG_WORLD_PARK_COMPARISON_MODULE_STORE.location(column,value),warnIfTruncated:dgWarnIfTruncated,fit:fitRows});
}
function fitRows(m,rows,label,icon){
/* dgValidCoord same guard: const pts=(rows||[]).filter(r=>dgValidCoord(r.lat,r.lon)); */
return window.DG_FIT_MEASUREMENT_ROWS.fit(m,rows,label,icon,{isValidCoordinate:dgValidCoord,bounds:points=>L.latLngBounds(points),toast,translate:dgCf});
}
