"use strict";
/* Mobile surface review: scan → live preview → explicit acceptance.
 * Raster baseline stays read-only. Geometry clipping and cloud persistence
 * are isolated in lc-review.js. Accepted snapshots are bound to source/grid. */
const _tvs=s=>typeof dgCf==="function"?dgCf(s):s;
const _tvst=(s,v)=>typeof dgTfs==="function"?dgTfs(s,v):s.replace(/\{(\w+)\}/g,(m,k)=>v[k]??m);
const DG_SENS={record:null,layer:null,busy:false,saving:false,showCand:true,base:"sat",guard:true,debounce:null,epoch:0,focus:null,editing:true,revision:0,geometry:null,parkGeometry:null,epsg:null,hostParent:null,hostNext:null,status:"",draw:null,drawLayer:null,localQueue:Promise.resolve(),opacity:45,visualVersion:0,baselineShown:false};
const DG_SENS_COLORS={green:"#22c55e",water:"#3b82f6",hard:"#64748b",bare:"#8b5a2b",building:"#475569",pool:"#0ea5e9",other:"#94a3b8"};
const DG_SENS_CLASSES=["green","water","hard","bare"];
function dgSensGuard(on){DG_SENS.guard=!!on;window._dgSensGuard=!!on;}
function dgSensModeAnalysis(){dgSensGuard(true);dgSensRender();}
function dgSensModePark(){
  dgSensGuard(false);
  if(DG_SENS.draw)dgSensDrawCancel();
  if(typeof PARK_MODE!=="undefined"&&!PARK_MODE&&typeof toggleParkMode==="function")toggleParkMode();
  dgSensRender();
}
function dgSensParkId(){try{if(typeof DG_PARK!=="undefined"&&DG_PARK?.id)return{id:DG_PARK.id,name:DG_PARK.name||""};}catch(e){}return{id:null,name:""};}
function dgSensCells(){return typeof DG_LC_LAST!=="undefined"&&Array.isArray(DG_LC_LAST?.result?.cells)?DG_LC_LAST.result.cells:null;}
function dgSensGroupAreas(){return typeof DG_LC_LAST!=="undefined"?DG_LC_LAST?.result?.groupAreas||{}:{};}
function dgSensMeta(k){return window.DG_LC_VALIDATE?.labels?.[k]||{tr:window.DG_SURFACE_REVIEW?.types?.[k]?.label||k,emoji:""};}
function dgSensHa(a){return(Number(a||0)/10000).toFixed(3);}
function dgSensNewRecord(){const pk=dgSensParkId(),owner=typeof USER!=="undefined"?USER?.id:null;return{id:"surface-"+(owner||"guest")+"-"+(pk.id||"x"),owner,parkId:pk.id,parkName:pk.name,sens:{green:50,water:50,hard:50,bare:50},corrections:{},features:[],profile:null,period:"latest",createdAt:new Date().toISOString()};}
async function dgSensLoadRecord(){
 const fresh=dgSensNewRecord();let local=null,remote=null;
 try{const rows=await window.DG_LC_VALIDATE.loadCampaigns(fresh.parkId);local=rows.find(r=>r.id===fresh.id&&r.owner===fresh.owner);if(!local&&fresh.parkId){const drafts=await window.DG_LC_VALIDATE.loadCampaigns(null);const fp=await window.DG_SURFACE_REVIEW.fingerprint(dgSensCells(),PARK_POLY,PARK_HOLES||[],{year:DG_LC_LAST.report?.year,engine:DG_LC_ENGINE_VERSION});const old=drafts.find(r=>r.id==="surface-"+fresh.owner+"-x"&&r.owner===fresh.owner&&r.fingerprint===fp);if(old)local={...old,id:fresh.id,parkId:fresh.parkId,parkName:fresh.parkName};}}catch(e){}
 let revision=0;
 if(fresh.owner&&fresh.parkId&&typeof sb!=="undefined"){
  try{const r=await window.DG_SURFACE_REVIEW.load(fresh.parkId,fresh.owner);if(r){remote=r.payload;remote.fingerprint=r.source_fingerprint;revision=r.revision;}}
  catch(e){DG_SENS.status=_tvs("Hesap kaydı yüklenemedi; cihaz taslağı kullanılıyor.");}
 }
 const chosen=local&&(!remote||String(local.modifiedAt||"")>String(remote.modifiedAt||""))?local:remote||local||fresh;
 const safe=chosen.owner===fresh.owner&&String(chosen.parkId)===String(fresh.parkId)?chosen:fresh;
 const sens={...fresh.sens};for(const k of DG_SENS_CLASSES){const n=Number(safe.sens?.[k]);sens[k]=Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;}
 return{...fresh,...safe,serverRevision:revision,sens,corrections:safe.corrections&&typeof safe.corrections==="object"&&!Array.isArray(safe.corrections)?safe.corrections:{},features:Array.isArray(safe.features)?safe.features.filter(f=>window.DG_SURFACE_REVIEW.types[f.type]&&window.DG_SURFACE_REVIEW.validRing(f.ring)):[]};
}
function dgSensSave(){
 if(!DG_SENS.record)return Promise.resolve(false);
 DG_SENS.record.modifiedAt=new Date().toISOString();
 const snapshot=JSON.parse(JSON.stringify(DG_SENS.record));
 const job=DG_SENS.localQueue.catch(()=>{}).then(()=>window.DG_LC_VALIDATE.saveCampaign(snapshot));
 DG_SENS.localQueue=job;
 return job.then(()=>true).catch(()=>{if(DG_SENS.record?.id===snapshot.id){DG_SENS.status=_tvs("Cihaz kaydı başarısız. Kaydet düğmesiyle hesap kaydını deneyin.");dgSensUpdateStatus();}return false;});
}
function dgSensDirty(){DG_SENS.visualVersion++;DG_SENS.editing=true;if(DG_SENS.record)DG_SENS.record.draftDirty=true;DG_SENS.status="";}
function dgSensPredict(sp){return window.DG_LC_VALIDATE.spectralPredict(sp,DG_SENS.record?.sens);}
function dgSensCellKey(c){return c.row+":"+c.col;}
function dgSensEffective(c){
 const rec=DG_SENS.record,key=dgSensCellKey(c),dec=rec?.corrections?.[key];
 const original=c.rasterClassKey||c.classKey;
 if(dec&&(dec.method!=="sensitivity"||!DG_SENS.editing))return window.DG_SURFACE_REVIEW.types[dec.to]?dec.to:original;
 if(!DG_SENS.editing)return original;
 if(Number(c.areaM2)<window.DG_LC_VALIDATE.defaults.edgeAreaM2)return original;
 const pred=dgSensPredict(rec?.profile?.cells?.[key]);
 return DG_SENS_CLASSES.includes(pred)?pred:original;
}
function dgSensCandidates(cls){return(dgSensCells()||[]).filter(c=>dgSensEffective(c)===cls&&c.classKey!==cls).map(cell=>({cell,pred:cls,sp:DG_SENS.record?.profile?.cells?.[dgSensCellKey(cell)]}));}
async function dgSensMount(hostId){
 const host=document.getElementById(hostId||"lcSens"),cells=dgSensCells();if(!host||!cells?.length)return;
 const epoch=++DG_SENS.epoch;DG_SENS.status="";dgSensGuard(true);
 const rec=await dgSensLoadRecord();if(epoch!==DG_SENS.epoch)return;
 const R=window.DG_SURFACE_REVIEW;
 const fingerprint=await R.fingerprint(cells,PARK_POLY,PARK_HOLES||[],{year:DG_LC_LAST.report?.year,engine:DG_LC_ENGINE_VERSION});if(epoch!==DG_SENS.epoch)return;
 if(rec.fingerprint&&rec.fingerprint!==fingerprint){Object.assign(rec,{corrections:{},features:[],objectFeatures:null,profile:null,acceptedAt:null,acceptedAreas:null,acceptedResult:null});DG_SENS.status=_tvs("Park sınırı veya veri değişti; eski kararlar yeni veriye uygulanmadı.");}
 rec.fingerprint=fingerprint;
 if(rec.profile?.radiometryVersion!=="pb04-offset-v1")rec.profile=null;
 DG_SENS.record=rec;DG_SENS.revision=rec.serverRevision||0;DG_SENS.editing=!!rec.draftDirty||!rec.acceptedAt||!rec.acceptedResult;
 if(rec.acceptedAt&&!rec.acceptedResult)DG_SENS.status=_tvs("Önceki kabul alanları hesabınızda korunuyor. Bu yeni harita önizlemesini kontrol edip kaydedin.");DG_SENS.focus=null;DG_SENS.showCand=true;
 DG_SENS.epsg=cells[0].epsg;
 if(!rec.acceptedAt&&rec.objectVersion!=="footprints-v2")rec.objectFeatures=null;
 DG_SENS.hostParent=host.parentNode;DG_SENS.hostNext=host.nextSibling;
 const mapEl=document.getElementById("map");
 if(mapEl){mapEl.after(host);mapEl.classList.add("surface-review-map");}
 host.style.display="block";
 dgSensGuard(true); /* 0056: analiz başladı — park algılama duraklatıldı */
 if(typeof DG_LC_LAYER!=="undefined"&&DG_LC_LAYER&&map.hasLayer(DG_LC_LAYER)){DG_SENS.baselineShown=true;map.removeLayer(DG_LC_LAYER);}
 DG_SENS.base=document.getElementById("baseLayerSelect")?.value||DG_SENS.base;
 if(typeof switchBaseLayer==="function")switchBaseLayer(DG_SENS.base);
 document.getElementById("v-map")?.classList.add("surface-review-active");
 map.invalidateSize({pan:false});
 if(typeof ResizeObserver!=="undefined"){DG_SENS.resizeObserver?.disconnect();DG_SENS.resizeObserver=new ResizeObserver(()=>map.invalidateSize({pan:false}));DG_SENS.resizeObserver.observe(mapEl);}
 map.on("moveend",dgSensRefreshLayer);
 await dgSensRepartition();if(epoch!==DG_SENS.epoch)return;if(rec.acceptedResult&&!DG_SENS.editing)dgSensRenderAccepted();
 const pending=document.getElementById("surfacePendingTools");if(pending)pending.style.display="none";
 host.scrollIntoView({block:"nearest"});
}
function dgSensAreas(){
 if(!DG_SENS.record||!DG_SENS.geometry)return null;
 return window.DG_SURFACE_REVIEW.summarize(dgSensGroupAreas(),dgSensCells(),dgSensEffective,DG_SENS.geometry,dgSensFeatures(),DG_SENS.epsg,DG_SENS.parkGeometry);
}
function dgSensAdjusted(){const a=dgSensAreas();if(!a)return null;const rec=DG_SENS.record,n=Object.keys(rec.corrections).length;return{raster:dgSensGroupAreas(),corrected:a,n,nCorrected:n,nConfirmed:0};}
function dgSensRememberSection(el){DG_SENS.sections=DG_SENS.sections||{};DG_SENS.sections[el.id]=el.open;}
function dgSensRender(){
 const host=document.getElementById("lcSens"),rec=DG_SENS.record;if(!host||!rec)return;
 const scanned=!!rec.profile?.cells,disabled=DG_SENS.busy||DG_SENS.saving||DG_SENS.exporting;
 let h=`<div class="dg-sens-head"><div><div class="dg-png-kicker">🛰 ${esc(_tvs("Yüzey düzenleme"))}</div><p class="dg-sens-hint">${esc(_tvs("Tara, haritada ayarla, doğru gördüğün sonucu kaydet."))}</p></div><button id="dgSensScanBtn" type="button" class="dg-png-btn ${scanned?"ghost":"primary"} sm" onclick="dgSensScan()" ${disabled?"disabled":""}>${DG_SENS.busy?"⏳":scanned?"🔁":"🔍"} ${esc(_tvs(scanned?"Yeniden Tara":"Tara"))}</button></div>`;
 if(scanned){
  const dates=(rec.profile.scenes||[]).filter(s=>s.usedCells>0).map(s=>s.datetime).sort();
  h+=`<p class="dg-sens-hint">Sentinel‑2 L2A · ${esc(dates[0]||"—")} – ${esc(dates.at(-1)||"—")} · ${rec.profile.stats?.nProfiled||0}/${dgSensCells().length} ${esc(_tvs("hücre"))} · 10 / 20 m</p>`;
 }
 h+=`<p class="dg-sens-hint">${esc(_tvs("Uydu altlığının tarihi bu tarihlerden farklı olabilir. Küçük bina ve havuzlar için sınır düzeltmesini kullanın."))}</p>`;
 h+=`<div class="dg-sens-map-tools"><label for="dgSensBaseSelect">${esc(_tvs("Harita"))}</label><select id="dgSensBaseSelect" onchange="dgSensBase(this.value)">${[["osm","Sokak"],["sat","Uydu"],["topo","Topoğrafik"]].map(([v,t])=>`<option value="${v}" ${DG_SENS.base===v?"selected":""}>${esc(_tvs(t))}</option>`).join("")}</select><button type="button" class="dg-png-btn ghost sm" onclick="dgChooseNewPark()">📍 ${esc(_tvs("Yeni konum"))}</button></div>`;
 for(const k of DG_SENS_CLASSES){const m=dgSensMeta(k);h+=`<div class="dg-sens-row"><button type="button" class="dg-sens-label" onclick="dgSensFocus('${k}')" aria-pressed="${DG_SENS.focus===k}">${m.emoji} ${esc(_tvs(m.tr))}</button><input id="dgSensRange-${k}" type="range" class="dg-sens-slider" min="0" max="100" step="1" value="${rec.sens[k]}" oninput="dgSensSlide('${k}',this.value)" aria-label="${esc(_tvs(m.tr))} ${esc(_tvs("hassasiyet"))}" ${!scanned||disabled?"disabled":""}><output class="dg-sens-count" id="dgSensCnt-${k}"></output></div>`;}
 h+=`<div class="dg-sens-row"><label class="dg-sens-label" for="dgSensOpacity">${esc(_tvs("Renk yoğunluğu"))}</label><input id="dgSensOpacity" type="range" class="dg-sens-slider" min="0" max="100" value="${DG_SENS.opacity}" oninput="dgSensOpacity(this.value)"><output class="dg-sens-count" id="dgSensOpacityValue">%${DG_SENS.opacity}</output></div>`;
 h+=`<p class="dg-sens-hint">${esc(_tvs("Bina ve havuz alanları ayrı hesaplanır."))} · OSM: ${(rec.objectFeatures||[]).length} ${esc(_tvs("nesne sınırı"))}</p><div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost sm" onclick="dgSensFocus(null)">${esc(_tvs("Tüm sınıflar"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensToggleCand(!DG_SENS.showCand)">${esc(_tvs(DG_SENS.showCand?"Görüntüyü göster":"Renkleri göster"))}</button><button type="button" class="dg-png-btn primary" id="dgSensAcceptBtn" onclick="dgSensAccept()" ${disabled?"disabled":""}>💾 ${esc(_tvs("Kabul et ve kaydet"))}</button></div><div id="dgSensSummary" class="dg-sens-adj"></div><p id="dgSensStatus" class="dg-sens-hint" role="status"></p>`;
 h+=`<details id="dgSensBoundaryDetails" ${DG_SENS.sections?.dgSensBoundaryDetails?"open":""} class="dg-sens-details" ontoggle="dgSensRememberSection(this)"><summary>${esc(_tvs("Sınır düzeltme"))}</summary><p class="dg-sens-hint">${esc(_tvs("Sınıfı seç, haritada sınır köşelerine dokun, çizimi tamamla. Çizilen alan park sınırına kırpılır."))}</p><select id="dgSensDrawType" aria-label="${esc(_tvs("Yüzey türü"))}">${["building","pool","hard","water","green","bare"].map(k=>`<option value="${k}">${esc(_tvs(window.DG_SURFACE_REVIEW.types[k].label))}</option>`).join("")}</select><div class="dg-sens-actions"><button type="button" class="dg-png-btn blue sm" onclick="dgSensDrawStart()">✏ ${esc(_tvs("Sınır çiz"))}</button><button type="button" class="dg-png-btn primary sm" onclick="dgSensDrawFinish()">✓ ${esc(_tvs("Çizimi tamamla"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensDrawBack()">↩ ${esc(_tvs("Son köşeyi sil"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensDrawCancel()">${esc(_tvs("İptal"))}</button></div><div id="dgSensFeatures">${(rec.features||[]).map((f,i)=>`<div class="dg-sens-feature"><span>${esc(_tvs(window.DG_SURFACE_REVIEW.types[f.type]?.label||f.type))}</span><button type="button" class="dg-png-btn ghost sm" onclick="dgSensRemoveFeature(${i})">↩ ${esc(_tvs("Geri al"))}</button></div>`).join("")}</div></details>`;
 h+=`<details id="dgSensDataDetails" ${DG_SENS.sections?.dgSensDataDetails?"open":""} class="dg-sens-details" ontoggle="dgSensRememberSection(this)"><summary>${esc(_tvs("Veri ve ayarlar"))}</summary><label class="measure-share"><input class="dg-switch" type="checkbox" ${rec.useObjects!==false?"checked":""} onchange="dgSensObjects(this.checked)"> ${esc(_tvs("OSM bina, su ve sert zemin sınırlarını kullan"))}</label><p class="dg-sens-hint">${esc(_tvs("Kaydırıcı eşikleri değiştirir; çözünürlüğü veya doğruluk garantisini artırmaz. Kabul, görsel inceleme kararınızı kaydeder."))}</p><label class="dg-png-label" for="dgSensPeriod">${esc(_tvs("Uydu tarama dönemi"))}</label><select id="dgSensPeriod" onchange="dgSensPeriod(this.value)"><option value="latest" ${rec.period==="latest"?"selected":""}>${esc(_tvs("Güncel görüntüler · son 120 gün"))}</option><option value="ref" ${rec.period==="ref"?"selected":""}>2021</option></select><p class="dg-sens-hint">${esc(_tvs("Tarama, bugün ile 120 gün öncesi arasındaki uygun Sentinel-2 görüntülerini arar. Bulut nedeniyle kullanılan tarihler daha eski olabilir. Altlık haritasının tarihi ve 2021 raster verisi ayrıdır."))}</p><div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost sm" onclick="dgSensModePark()">🌳 ${esc(_tvs("Park seç"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensModeAnalysis()">🛰 ${esc(_tvs("Analiz"))}</button><button type="button" class="dg-png-btn primary sm" onclick="dgSensExportPng()">🖼️ ${esc(_tvs("Doğrulanmış Harita"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensExportGeoJson()">📥 GeoJSON</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensExportCsv()">📥 CSV</button><button type="button" class="dg-png-btn red sm" onclick="dgSensReset()">${esc(_tvs("Kararları sıfırla"))}</button></div></details>`;
 host.innerHTML=h;dgSensUpdateSummary();dgSensUpdateStatus();
}
function dgSensOpacity(value){DG_SENS.opacity=Math.max(0,Math.min(100,Number(value)||0));const out=document.getElementById("dgSensOpacityValue");if(out)out.textContent="%"+DG_SENS.opacity;for(const p of DG_SENS.displayPaths||[])p.poly.setStyle({fillOpacity:DG_SENS.opacity/100});dgSensRefreshLayer();}
function dgSensUpdateSummary(){
 const a=dgSensAreas(),rec=DG_SENS.record;if(!a||!rec)return;
 for(const k of DG_SENS_CLASSES){const el=document.getElementById("dgSensCnt-"+k);if(el)el.textContent=rec.sens[k]+" · "+dgSensHa(a[k])+" ha";}
 dgSensRenderCurrentReport(a);
 const el=document.getElementById("dgSensSummary");if(el)el.textContent=_tvs(DG_SENS.editing?"Önizleme":"Kayıtlı sonuç")+" · "+Object.keys(a).filter(k=>a[k]>0).map(k=>_tvs(window.DG_SURFACE_REVIEW.types[k]?.label||k)+": "+dgSensHa(a[k])+" ha").join(" · ");
}
function dgSensUpdateStatus(){const el=document.getElementById("dgSensStatus");if(el)el.textContent=DG_SENS.status||_tvs(DG_SENS.record?.acceptedAt&&!DG_SENS.editing?"Kayıtlı sonuç korunuyor. Kaydırıcıyı değiştirerek yeni önizleme yapabilirsiniz.":"Önizleme henüz hesap kaydına yazılmadı.");}
async function dgSensScan(){
 if(DG_SENS.busy||DG_SENS.saving||!DG_SENS.record)return;
 const rec=DG_SENS.record,epoch=DG_SENS.epoch;DG_SENS.busy=true;dgSensRender();
 try{
  const profile=await window.DG_LC_S2.profile(dgSensCells(),PARK_POLY,{year:DG_LC_LAST.report?.year||2021,mode:rec.period});
  if(epoch!==DG_SENS.epoch||DG_SENS.record!==rec)return;
  rec.profile=profile;rec.scannedAt=new Date().toISOString();dgSensDirty();DG_SENS.status=_tvs("Tarama tamamlandı. Renkleri haritada kontrol edin.");
  rec.objectFeatures=null;rec.objectVersion="footprints-v2";
  await dgSensRepartition();
  await dgSensSave();
 }catch(e){if(epoch===DG_SENS.epoch){DG_SENS.status=_tvs("Tarama başarısız: ")+String(e.message||e);toast(DG_SENS.status,"err");}}
 finally{if(epoch===DG_SENS.epoch){DG_SENS.busy=false;dgSensRender();dgSensRefreshLayer();}}
}
function dgSensPeriod(v){if(DG_SENS.busy||DG_SENS.saving)return;DG_SENS.record.period=v==="ref"?"ref":"latest";dgSensScan();}
function dgSensSlide(cls,val){
 const rec=DG_SENS.record;if(!rec||DG_SENS.busy||DG_SENS.saving||!DG_SENS_CLASSES.includes(cls))return;
 const n=Number(val);rec.sens[cls]=Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;
 dgSensDirty();DG_SENS.focus=cls;DG_SENS.showCand=true;DG_SENS.status="";
 if(!DG_SENS.debounce)DG_SENS.debounce=setTimeout(()=>{DG_SENS.debounce=null;dgSensRefreshLayer();dgSensUpdateSummary();dgSensUpdateStatus();},80);
 clearTimeout(DG_SENS.saveTimer);DG_SENS.saveTimer=setTimeout(()=>dgSensSave(),900);
}
function dgSensFocus(cls){DG_SENS.focus=cls;dgSensRefreshLayer();}
function dgSensToggleCand(on){DG_SENS.showCand=!!on;dgSensRefreshLayer();dgSensRender();}
function dgSensBase(type){if(!["osm","sat","topo"].includes(type))return;DG_SENS.base=type;switchBaseLayer(type);}
async function dgSensRefreshLayer(){
 if(typeof map==="undefined"||!map||!window.L||!DG_SENS.record||!DG_SENS.geometry)return;
 if(!DG_SENS.layer){DG_SENS.layer=L.layerGroup().addTo(map);DG_SENS.renderer=L.canvas({padding:.1});DG_SENS.pathCache=new WeakMap();}
 if(!DG_SENS.showCand){DG_SENS.layer.clearLayers();return;}
 const key=[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,DG_SENS.editing].join(":");
 if(DG_SENS.mergedKey!==key){
  if(DG_SENS.mergeBusy)return;
  const epoch=DG_SENS.epoch;DG_SENS.mergeBusy=true;
  try{const parts=window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,DG_SENS.geometry,dgSensFeatures(),DG_SENS.epsg,DG_SENS.parkGeometry);
   const job=await dgSurfaceWorkerJob({job:"merge",parts:parts.map(p=>({type:p.type,geom:p.geom,areaM2:p.areaM2,method:p.method})),epsg:DG_SENS.epsg});
   if(epoch!==DG_SENS.epoch)return;
   DG_SENS.mergedFeatures=job?.features||dgSurfaceMergeSync(parts,DG_SENS.epsg);DG_SENS.mergedKey=key;DG_SENS.layer.clearLayers();DG_SENS.displayPaths=[];
   for(const f of DG_SENS.mergedFeatures){const cls=f.properties.class;
    const rings=f.geometry.coordinates.map(poly=>poly.map(r=>dgSensSoftRing(r,DG_SENS.epsg,f.properties.display_boundary==="exact"||/boundary/.test(f.properties.method||""))));
    const poly=L.polygon(rings,{renderer:DG_SENS.renderer,stroke:false,weight:0,smoothFactor:1,bubblingMouseEvents:false,fillColor:DG_SENS_COLORS[cls]||DG_SENS_COLORS.other});
    poly.on("click",ev=>{const oe=ev.originalEvent||ev;if(oe&&L.DomEvent?.stopPropagation)L.DomEvent.stopPropagation(oe);if(DG_SENS.draw){dgSensDrawPoint(ev);return;}const q=dgLcUtmForward(ev.latlng.lat,ev.latlng.lng,DG_SENS.epsg);const part=window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,DG_SENS.geometry,dgSensFeatures(),DG_SENS.epsg,DG_SENS.parkGeometry).find(p=>dgGridPointDistance([q.x,q.y],p.geom)>=0);if(part)dgSensPopup(part.key);});
    DG_SENS.displayPaths.push({poly,cls});
   }
  }catch(e){if(epoch===DG_SENS.epoch){DG_SENS.status=String(e.message||e);dgSensUpdateStatus();}}
  finally{DG_SENS.mergeBusy=false;}
  if(key!==[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,DG_SENS.editing].join(":")){if(DG_SENS.record)setTimeout(dgSensRefreshLayer,0);return;}
 }
 if(!DG_SENS.showCand){DG_SENS.layer?.clearLayers();return;}
 for(const p of DG_SENS.displayPaths||[]){p.poly.setStyle({fillOpacity:DG_SENS.opacity/100});if(!DG_SENS.focus||p.cls===DG_SENS.focus){if(!DG_SENS.layer.hasLayer(p.poly))p.poly.addTo(DG_SENS.layer);}else DG_SENS.layer.removeLayer(p.poly);}
}
/* Cartographic rounding only. Exact object outlines, calculation geometry and exports remain intact. */
function dgSensSoftRing(ring,epsg,exact=false){
 if(exact)return ring.map(p=>[p[1],p[0]]);
 const closed=ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1];
 const pts=(closed?ring.slice(0,-1):ring).map(p=>dgLcUtmForward(p[1],p[0],epsg)),out=[];
 for(let i=0;i<pts.length;i++){
  const p=pts[i],prev=pts[(i+pts.length-1)%pts.length],next=pts[(i+1)%pts.length];
  const inset=q=>{const d=Math.hypot(q.x-p.x,q.y-p.y),t=d?Math.min(.4,4/d):0;return{x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};};
  const a=inset(prev),b=inset(next);
  for(let step=0;step<=4;step++){const t=step/4,u=1-t,z=dgLcUtmInverse(u*u*a.x+2*u*t*p.x+t*t*b.x,u*u*a.y+2*u*t*p.y+t*t*b.y,epsg);out.push([z.lat,z.lon]);}
 }
 if(out.length)out.push(out[0]);return out;
}

async function dgSensRepartition(){
 const rec=DG_SENS.record;if(!rec)return;const epoch=DG_SENS.epoch;
 DG_SENS.busy=true;DG_SENS.geometry=null;dgSensRender();
 try{
  const data=await dgSurfacePrepare({cells:dgSensCells(),outer:PARK_POLY,holes:PARK_HOLES||[],epsg:DG_SENS.epsg,objects:rec.objectFeatures||null,elements:window.DG_SURFACE_OSM?.boundary===JSON.stringify(PARK_POLY)?window.DG_SURFACE_OSM.elements:[],features:rec.features||[],useObjects:rec.useObjects});
  if(epoch!==DG_SENS.epoch)return;
  if(!rec.objectFeatures){rec.objectFeatures=data.objects;rec.objectVersion="footprints-v2";}
  DG_SENS.partitionVersion=(DG_SENS.partitionVersion||0)+1;DG_SENS.parkGeometry=data.park;DG_SENS.geometry=data.geometries;
  // Structured cloning preserves geometry references; rebind cells to the UI's canonical array.
  const cells=new Map(dgSensCells().map(c=>[dgSensCellKey(c),c]));for(const p of data.parts)p.cell=cells.get(p.key);
  dgSurfaceSeed(data.geometries,dgSensFeatures(),DG_SENS.epsg,data.park,data.parts,dgSensCells());
  if(DG_SENS.layer)map.removeLayer(DG_SENS.layer);if(DG_SENS.renderer)map.removeLayer(DG_SENS.renderer);DG_SENS.layer=null;DG_SENS.renderer=null;
 }catch(e){if(epoch===DG_SENS.epoch){DG_SENS.status=String(e.message||e);toast(esc(DG_SENS.status),"err");}}
 finally{if(epoch===DG_SENS.epoch){DG_SENS.busy=false;dgSensRender();dgSensRefreshLayer();}}
}

function dgSensPopup(key){
 const c=dgSensCells()?.find(c=>dgSensCellKey(c)===key);if(!c)return;
 const cls=dgSensEffective(c),dec=DG_SENS.record.corrections[key];
 let html=`<div class="dg-sens-popup"><b>${esc(_tvs(dgSensMeta(cls).tr))}</b> · ${Number(c.areaM2).toFixed(1)} m²<p>${esc(_tvs("Görüntüdeki sınıfı seçerek bu hücreyi düzeltin."))}</p><div class="dg-sens-actions">`;
 for(const k of ["green","hard","building","water","pool","bare"])html+=`<button type="button" class="dg-png-btn ${k===cls?"primary":"ghost"} sm" onclick="dgSensDecide('${key}','${k}')">${dgSensMeta(k).emoji} ${esc(_tvs(dgSensMeta(k).tr))}</button>`;
 if(dec)html+=`<button type="button" class="dg-png-btn ghost sm" onclick="dgSensUndo('${key}')">↩ ${esc(_tvs("Geri al"))}</button>`;
 html+="</div></div>";L.popup({maxWidth:280}).setLatLng([c.center.lat,c.center.lon]).setContent(html).openOn(map);
}
function dgSensDecide(key,toCls){
 const c=dgSensCells()?.find(c=>dgSensCellKey(c)===key);if(!c||!window.DG_SURFACE_REVIEW.types[toCls]||DG_SENS.busy||DG_SENS.saving)return;
 DG_SENS.record.corrections[key]={from:c.classKey,to:toCls,method:"visual-cell",ts:new Date().toISOString()};dgSensDirty();map.closePopup();dgSensRefreshLayer();dgSensUpdateSummary();dgSensUpdateStatus();dgSensSave();
}
function dgSensUndo(key){if(!DG_SENS.record||DG_SENS.busy||DG_SENS.saving)return;delete DG_SENS.record.corrections[key];dgSensDirty();map.closePopup();dgSensRefreshLayer();dgSensUpdateSummary();dgSensSave();}
function dgSensBulk(cls){for(const x of dgSensCandidates(cls))dgSensDecide(dgSensCellKey(x.cell),cls);}
async function dgSensAccept(){
 const rec=DG_SENS.record;if(!rec||DG_SENS.saving||DG_SENS.busy||!DG_SENS.geometry||DG_SENS.draw)return;
 if(!rec.profile&&!dgSensFeatures().length&&!Object.keys(rec.corrections).length){toast(_tvs("Önce tarama veya sınır düzeltmesi yapın."),"warn");return;}
 const epoch=DG_SENS.epoch,snapshot=JSON.parse(JSON.stringify(rec));
 // Keep immutable geometry identities so acceptance cannot invalidate the partition cache.
 snapshot.features=rec.features;snapshot.objectFeatures=rec.objectFeatures;
 for(const c of dgSensCells()){const key=dgSensCellKey(c);if(snapshot.corrections[key]?.method!=="visual-cell")snapshot.corrections[key]={from:c.classKey,to:dgSensEffective(c),method:"sensitivity",ts:new Date().toISOString()};}
 snapshot.draftDirty=false;snapshot.acceptedAreas=dgSensAreas();snapshot.acceptedAt=new Date().toISOString();snapshot.modifiedAt=snapshot.acceptedAt;
 DG_SENS.saving=true;dgSensRender();
 try{
  snapshot.acceptedResult=await dgSensResultSnapshot(snapshot);
  if(epoch!==DG_SENS.epoch||DG_SENS.record!==rec)return;
  if(!snapshot.owner||!snapshot.parkId)throw Error(_tvs("Hesaba kaydetmek için giriş yapın ve kayıtlı bir park seçin."));
  const revision=await window.DG_SURFACE_REVIEW.save(snapshot,DG_SENS.revision);
  if(epoch!==DG_SENS.epoch)return;
  snapshot.serverRevision=revision;DG_SENS.record=snapshot;DG_SENS.revision=revision;dgSensRenderAccepted();DG_SENS.editing=false;DG_SENS.focus=null;
  const cached=await dgSensSave();DG_SENS.status=_tvs("✓ Sonuç hesabınıza kaydedildi; başka cihazda da açılabilir.")+(cached?"":" · "+_tvs("Cihaz önbelleği yazılamadı."));
  toast(DG_SENS.status,"ok");
 }catch(e){if(epoch===DG_SENS.epoch){const local=await dgSensSave();DG_SENS.status=_tvs("Hesaba kaydedilemedi: ")+String(e.message||e)+(local?" · "+_tvs("Taslak bu cihazda saklandı."):"");toast(DG_SENS.status,"err");}}
 finally{if(epoch===DG_SENS.epoch){DG_SENS.saving=false;dgSensRender();dgSensRefreshLayer();}}
}
function dgSensReset(){if(DG_SENS.busy||DG_SENS.saving||!confirm(_tvs("Tüm kararlar silinsin mi? (Tarama profili kalır)")))return;DG_SENS.record.corrections={};DG_SENS.record.features=[];dgSensDirty();dgSensRepartition().then(dgSensSave);}
function dgSensDrawStart(){if(DG_SENS.busy||DG_SENS.saving)return;map.invalidateSize({pan:false});dgSensDrawCancel();DG_SENS.draw={type:document.getElementById("dgSensDrawType").value,ring:[]};DG_SENS.status=_tvs("Haritada sınır köşelerine dokunun; ardından çizimi tamamlayın.");dgSensUpdateStatus();dgSensGuard(true);map.on("click",dgSensDrawPoint);}
function dgSensDrawPoint(ev){if(!DG_SENS.draw||!ev.latlng)return;const p=[ev.latlng.lng,ev.latlng.lat];if(DG_SENS.draw.ring.length>=300)return;DG_SENS.draw.ring.push(p);dgSensDrawRender();}
function dgSensDrawRender(){if(DG_SENS.drawLayer)map.removeLayer(DG_SENS.drawLayer);DG_SENS.drawLayer=L.layerGroup().addTo(map);const pts=DG_SENS.draw.ring.map(p=>[p[1],p[0]]);if(pts.length>1)L.polyline(pts,{color:DG_SENS_COLORS[DG_SENS.draw.type],dashArray:"4,4",interactive:false}).addTo(DG_SENS.drawLayer);for(const p of pts)L.circleMarker(p,{radius:5,color:DG_SENS_COLORS[DG_SENS.draw.type],interactive:false}).addTo(DG_SENS.drawLayer);}
function dgSensDrawBack(){if(DG_SENS.draw){DG_SENS.draw.ring.pop();dgSensDrawRender();}}
function dgSensDrawCancel(){if(DG_SENS.drawLayer)map.removeLayer(DG_SENS.drawLayer);DG_SENS.drawLayer=null;DG_SENS.draw=null;map.off("click",dgSensDrawPoint);}
function dgSensDrawFinish(){
 const d=DG_SENS.draw;if(!d)return;
 if(!window.DG_SURFACE_REVIEW.validRing(d.ring)){toast(_tvs("En az üç köşe seçin; sınır kendi üzerine kesişmemeli."),"warn");return;}
 const geom=window.polygonClipping.intersection([dgSurfaceProject(d.ring,DG_SENS.epsg)],DG_SENS.parkGeometry);
 if(dgSurfaceArea(geom)<.1){toast(_tvs("Çizim park sınırının dışında veya çok küçük."),"warn");return;}
 DG_SENS.record.features.push({...d,method:"visual-boundary",ts:new Date().toISOString()});dgSensDirty();dgSensDrawCancel();dgSensRepartition().then(dgSensSave);
}
function dgSensRemoveFeature(i){if(DG_SENS.busy||DG_SENS.saving)return;DG_SENS.record.features.splice(i,1);dgSensDirty();dgSensRepartition().then(dgSensSave);}
function dgSensExportGeoJson(){
 const rec=DG_SENS.record;if(!rec||!DG_SENS.geometry||DG_SENS.busy)return;
 const parts=window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,DG_SENS.geometry,dgSensFeatures(rec),DG_SENS.epsg,DG_SENS.parkGeometry);
 const features=parts.map(p=>({type:"Feature",properties:{row:p.cell.row,column:p.cell.col,original_class:p.cell.classKey,review_class:p.type,group:p.group,area_m2:p.areaM2,method:p.method,source_fingerprint:rec.fingerprint,accepted_at:rec.acceptedAt||null,view:DG_SENS.editing?"preview":"accepted"},geometry:{type:"MultiPolygon",coordinates:dgSurfaceUnproject(p.geom,DG_SENS.epsg)}}));
 downloadBlob("dendrogeo_surface_"+rec.parkId+".geojson","application/geo+json",JSON.stringify({type:"FeatureCollection",features}));
}
/* ── 0058: DOĞRULANMIŞ HARİTA PNG (infografik çıktı) ────────────────
 * Kullanıcı isteği: "iyileştirmeden sonra böyle bir çıktı alalım" (X
 * lansman infografiği). Kabul/düzeltme kararlarından SONRA tek tıkla
 * marka çerçeveli infografik PNG: hücreler dgSensEffective rengiyle
 * (kabul edilmiş anlık görüntü), çizilen bina/havuz maskeleri üstte,
 * sağ sütunda dgSensAreas()'nin ALT-HÜCRE doğrulanmış alanları (polygon
 * clipping dahil), alt bantta parmak izi + dönem + lisans künyesi.
 * Raster salt okunur kalır (kırmızı çizgi): tüm sayılar record/areas'tan. */
async function dgSensExportPng(){
  const rec=DG_SENS.record,cells=dgSensCells();
  if(!rec||!cells||!cells.length||DG_SENS.busy||DG_SENS.saving||!DG_SENS.geometry){toast(_tvs("Önce arazi örtüsü analizini çalıştırın."),"warn","🖼️");return;}
  const nDec=Object.values(rec.corrections||{}).filter(d=>d.method==="visual-cell").length+(rec.features||[]).length;
  if(!nDec&&!rec.acceptedAt&&!dgSensFeatures().length){toast(_tvs("Önce en az bir hücre kararı ver — doğrulanmış harita kararlarını gösterir."),"warn","🖼️");return;}
  const areas=dgSensAreas()||dgSensGroupAreas();
  const epsg=DG_SENS.epsg||dgLcUtmEpsgForLatLon(cells[0].center.lat,cells[0].center.lon);
  if(DG_SENS.exporting)return;
  const epoch=DG_SENS.epoch;DG_SENS.exporting=true;dgSensRender();
  try{
  const parts=window.DG_SURFACE_REVIEW.resolved(cells,dgSensEffective,DG_SENS.geometry,dgSensFeatures(),epsg,DG_SENS.parkGeometry);
  const merged=(await dgSurfaceWorkerJob({job:"merge",parts:parts.map(p=>({type:p.type,geom:p.geom,areaM2:p.areaM2,method:p.method})),epsg}))?.features||dgSurfaceMergeSync(parts,epsg);
  if(epoch!==DG_SENS.epoch)return;
  /* UTM zarfı */
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  const PR=(lat,lon)=>{const z=dgLcUtmForward(lat,lon,epsg);mnX=Math.min(mnX,z.x);mxX=Math.max(mxX,z.x);mnY=Math.min(mnY,z.y);mxY=Math.max(mxY,z.y);return z;};
  for(const c of cells)for(const q of (c.quadWgs||[]))PR(q[1],q[0]);
  if(typeof PARK_POLY!=="undefined"&&PARK_POLY)for(const r of PARK_POLY)for(const q of r)PR(q[0],q[1]);
  const CW=1240,CH=1560,cv=document.createElement("canvas");
  cv.width=CW;cv.height=CH;
  const g=cv.getContext("2d");
  const GREEN="#14532d",MUT="#5c6a63",INK="#182420",BGc="#f7f6f2";
  const COL=Object.assign({green:"#4ade80",water:"#3b82f6",hard:"#64748b",bare:"#8b5a2b",other:"#94a3b8"},DG_SENS_COLORS);
  g.fillStyle=BGc;g.fillRect(0,0,CW,CH);
  g.fillStyle=GREEN;g.fillRect(0,0,CW,120);
  g.fillStyle="#fff";g.font="bold 44px Arial";g.fillText("DENDROGEO",40,72);
  g.font="22px Arial";g.fillStyle="#cfe3d3";g.fillText("Küresel Ağaç Envanteri ve Karbon Veri Sistemi",40,102);
  g.fillStyle="#eaf5ec";g.font="bold 30px Arial";g.textAlign="right";g.fillText("dendrogeo.org",CW-40,70);g.textAlign="left";
  g.fillStyle=GREEN;g.font="bold 32px Arial";g.fillText("DOĞRULANMIŞ PARK HARİTASI",40,172);
  const pk=dgSensParkId();
  g.fillStyle=MUT;g.font="22px Arial";
  g.fillText((pk.name||"Park")+" · "+new Date().toISOString().slice(0,10)+" · "+nDec+" karar · "+(DG_SENS.editing?"ÖNİZLEME":"KABUL EDİLMİŞ v"+(rec.serverRevision||1)),40,206);
  const MX=40,MY=240,MW=760,MH=1180;
  g.fillStyle="#fff";g.fillRect(MX,MY,MW,MH);
  g.strokeStyle="#dfe5df";g.lineWidth=2;g.strokeRect(MX,MY,MW,MH);
  const sc=Math.min((MW-40)/((mxX-mnX)||1),(MH-40)/((mxY-mnY)||1));
  const ox=MX+(MW-(mxX-mnX)*sc)/2,oy=MY+(MH-(mxY-mnY)*sc)/2;
  const px=z=>[ox+(z.x-mnX)*sc,oy+(mxY-z.y)*sc];
  for(const feature of merged){
    g.beginPath();
    for(const poly of feature.geometry.coordinates)for(const ring of poly){const display=dgSensSoftRing(ring,epsg,feature.properties.display_boundary==="exact"||/boundary/.test(feature.properties.method||""));display.forEach((q,i)=>{const p=px(PR(q[0],q[1]));i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);});g.closePath();}
    g.fillStyle=COL[feature.properties.class]||COL.other;g.fill("evenodd");
  }
  if(typeof PARK_POLY!=="undefined"&&PARK_POLY&&PARK_POLY.length){
    g.beginPath();
    for(const r of PARK_POLY){let first=true;for(const q of r){const p=px(PR(q[0],q[1]));first?g.moveTo(p[0],p[1]):g.lineTo(p[0],p[1]);first=false;}g.closePath();}
    g.strokeStyle="#111827";g.lineWidth=2.5;g.stroke();
  }
  /* sağ sütun */
  const X0=840;
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("PARK SAHASI",X0,300);
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText((typeof parkAreaHa==="function"?parkAreaHa().toFixed(1):"—")+" ha",X0,352);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("KULLANICI DÜZENLEMESİ",X0,420,CW-X0-40);
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText(String(Object.values(rec.corrections||{}).filter(d=>d.method==="visual-cell").length+(rec.features||[]).length),X0,472);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("DOĞRULANMIŞ ALANLAR",X0,540);
  let y=580;
  for(const k of ["green","water","hard","bare","building","pool"]){
    const v=Number(areas[k]||0);
    if(v<=0&&k!=="green"&&k!=="water")continue;
    const lbl=(window.DG_SURFACE_REVIEW&&window.DG_SURFACE_REVIEW.types[k]?window.DG_SURFACE_REVIEW.types[k].label:k);
    g.fillStyle=COL[k]||COL.other;g.fillRect(X0,y,34,34);
    g.fillStyle=INK;g.font="bold 24px Arial";g.fillText(lbl,X0+48,y+18);
    g.fillStyle=MUT;g.font="22px Arial";g.fillText(dgSensHa(v)+" ha",X0+48,y+44);
    y+=76;
  }
  g.strokeStyle="#dfe5df";g.lineWidth=2;g.beginPath();g.moveTo(X0,y+6);g.lineTo(CW-40,y+6);g.stroke();
  g.fillStyle="#1d6b3c";g.font="bold 22px Arial";
  g.fillText("Bu harita raster + kullanıcı kararlarının",X0,y+44,CW-X0-40);
  g.fillText("birleşimidir; ham raster sonucu",X0,y+74,CW-X0-40);
  g.fillText("kaynak veride değişmeden korunur.",X0,y+104,CW-X0-40);
  g.fillStyle=GREEN;g.fillRect(0,CH-70,CW,70);
  g.fillStyle="#cfe3d3";g.font="19px Arial";
  g.fillText("Görsel sınırlar yumuşatılmıştır; alanlar özgün geometriden hesaplanır.",40,CH-52,CW-80);
  g.fillText("Raster: ESA WorldCover 2021 v200 (CC BY 4.0) · Uydu: Sentinel-2 "+String((rec.profile&&rec.profile.scenes&&rec.profile.scenes[0]&&rec.profile.scenes[0].datetime)||"—").slice(0,10)+" · parmak izi "+String(rec.fingerprint||"").slice(0,8)+" · CC BY-NC 4.0",40,CH-26,CW-80);
  cv.toBlob(b=>{
    if(!b){toast(_tvs("PNG üretilemedi."),"err","🖼️");return;}
    const u=URL.createObjectURL(b),a=document.createElement("a");
    a.href=u;a.download="dendrogeo_dogrulanmis_harita_"+(pk.id||"park")+".png";
    a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
    toast(_tvs("✓ Doğrulanmış harita PNG indirildi."),"ok","🖼️");
  },"image/png");
  }catch(e){if(epoch===DG_SENS.epoch)toast(esc(String(e.message||e)),"err","🖼️");}
  finally{if(epoch===DG_SENS.epoch){DG_SENS.exporting=false;dgSensRender();}}
}

function dgSensExportCsv(){const a=dgSensAreas();if(!a)return;const rec=DG_SENS.record;downloadBlob("dendrogeo_surface_"+rec.parkId+".csv","text/csv;charset=utf-8","\uFEFFclass,area_m2,area_ha,view,source_fingerprint\n"+Object.keys(a).map(k=>[k,a[k],a[k]/10000,DG_SENS.editing?"preview":"accepted",rec.fingerprint].join(",")).join("\n"));}
function dgSensCleanup(){
 ++DG_SENS.epoch;dgSurfaceCancelJobs();clearTimeout(DG_SENS.debounce);clearTimeout(DG_SENS.saveTimer);DG_SENS.debounce=null;DG_SENS.resizeObserver?.disconnect();DG_SENS.resizeObserver=null;
 if(typeof map!=="undefined"&&map){if(DG_SENS.layer)map.removeLayer(DG_SENS.layer);if(DG_SENS.renderer)map.removeLayer(DG_SENS.renderer);DG_SENS.renderer=null;DG_SENS.pathCache=null;dgSensDrawCancel();map.off("moveend",dgSensRefreshLayer);}
 const host=document.getElementById("lcSens");if(host){host.style.display="none";host.innerHTML="";if(DG_SENS.hostParent?.isConnected)DG_SENS.hostParent.insertBefore(host,DG_SENS.hostNext?.parentNode===DG_SENS.hostParent?DG_SENS.hostNext:null);else host.remove();}
 document.getElementById("map")?.classList.remove("surface-review-map");
 document.getElementById("v-map")?.classList.remove("surface-review-active");
 const pending=document.getElementById("surfacePendingTools");if(pending)pending.style.display="none";
 if(typeof map!=="undefined"&&map?.invalidateSize)map.invalidateSize({pan:false});
 Object.assign(DG_SENS,{record:null,layer:null,geometry:null,parkGeometry:null,busy:false,saving:false,exporting:false,baselineShown:false,baselineReport:null,mergedKey:null,mergedFeatures:null,displayPaths:null,hostParent:null,hostNext:null});
 dgSensGuard(false); /* 0056: park kapandı — algılama serbest */
}
window.DG_LC_SENS={mount:dgSensMount,cleanup:dgSensCleanup,guard:dgSensGuard,state:DG_SENS};

async function dgSensResultSnapshot(rec){
 const epsg=DG_SENS.epsg,cells=dgSensCells(),outer=PARK_POLY,holes=PARK_HOLES||[];
 const parts=window.DG_SURFACE_REVIEW.resolved(cells,dgSensEffective,DG_SENS.geometry,dgSensFeatures(rec),epsg,DG_SENS.parkGeometry);
 const totals={};for(const p of parts)totals[p.type]=(totals[p.type]||0)+p.areaM2;
 for(const [k,a] of Object.entries(rec.acceptedAreas))if(Math.abs(a-(totals[k]||0))>Math.max(.1,a*.00001))throw Error(_tvs("Analiz tüm parkı kapsamıyor. Parkı yeniden analiz edip tekrar kaydedin."));
 const job=await dgSurfaceWorkerJob({job:"merge",parts:parts.map(p=>({type:p.type,geom:p.geom,areaM2:p.areaM2,method:p.method})),epsg});
 const features=job?job.features:dgSurfaceMergeSync(parts,epsg);
 return{schema:"dendrogeo-surface/2",parkId:rec.parkId,acceptedAt:rec.acceptedAt,fingerprint:rec.fingerprint,epsg,cellCount:cells.length,areas:rec.acceptedAreas,outer,holes,scenes:rec.profile?.scenes||[],features};
}

function dgSensRenderCurrentReport(areas){
 const host=document.getElementById("landCoverReport");if(!host||!areas)return;
 if(DG_SENS.baselineReport==null)DG_SENS.baselineReport=host.innerHTML;
 const total=Object.values(areas).reduce((a,b)=>a+Number(b||0),0);
 host.innerHTML='<b>'+esc(_tvs(DG_SENS.editing?"Güncel yüzey önizlemesi":"Kayıtlı analiz sonucu"))+'</b>'+Object.entries(areas).filter(([k,v])=>v>0).map(([k,v])=>'<div class="dg-surface-stat"><span>'+esc(_tvs(window.DG_SURFACE_REVIEW.types[k]?.label||k))+'</span><b>'+dgSensHa(v)+' ha · %'+(total?100*v/total:0).toFixed(1)+'</b></div>').join('')+'<p class="dg-sens-hint">'+esc(_tvs(DG_SENS.editing?"Kaydırıcılar ve sınır düzeltmeleri bu özete yansır. Yayın için kabul edip kaydedin.":"Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez."))+'</p><details><summary>'+esc(_tvs("Ham 2021 raster sonucu"))+'</summary>'+DG_SENS.baselineReport+'</details>';
}
function dgSensRenderAccepted(){
 const r=DG_SENS.record?.acceptedResult,host=document.getElementById("landCoverReport");if(!r||!host)return;
 host.innerHTML='<b>'+esc(_tvs("Kayıtlı analiz sonucu"))+'</b><p>'+esc(new Date(r.acceptedAt).toLocaleString())+'</p>'+Object.entries(r.areas).filter(([k,v])=>v>0).map(([k,v])=>'<div>'+esc(_tvs(window.DG_SURFACE_REVIEW.types[k]?.label||k))+': <b>'+dgSensHa(v)+' ha</b></div>').join('')+'<p>'+esc(_tvs("Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez."))+'</p>';
}

function dgSensFeatures(rec=DG_SENS.record){return[...(rec?.useObjects!==false?rec?.objectFeatures||[]:[]),...(rec?.features||[])];}
function dgSensObjects(on){if(!DG_SENS.record||DG_SENS.busy||DG_SENS.saving)return;DG_SENS.record.useObjects=on;dgSensDirty();dgSensRepartition().then(dgSensSave);}
