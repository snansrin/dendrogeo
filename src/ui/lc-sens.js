"use strict";
/* Mobile surface review: scan → live preview → explicit acceptance.
 * Raster baseline stays read-only. Geometry clipping and cloud persistence
 * are isolated in lc-review.js. Accepted snapshots are bound to source/grid. */
const _tvs=s=>typeof dgCf==="function"?dgCf(s):s;
const _tvst=(s,v)=>typeof dgTfs==="function"?dgTfs(s,v):s.replace(/\{(\w+)\}/g,(m,k)=>v[k]??m);
const DG_SENS={record:null,layer:null,busy:false,saving:false,showCand:true,base:"sat",guard:true,debounce:null,epoch:0,focus:null,editing:true,revision:0,geometry:null,parkGeometry:null,epsg:null,hostParent:null,hostNext:null,status:"",draw:null,drawLayer:null,localQueue:Promise.resolve(),baselineShown:false};
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
function dgSensParkId(){try{if(DG_PARK_SESSION?.id)return{id:DG_PARK_SESSION.id,name:DG_PARK_SESSION.name||""};}catch(e){}return{id:null,name:""};}
function dgSensCells(){return typeof DG_LC_LAST!=="undefined"&&Array.isArray(DG_LC_LAST?.result?.cells)?DG_LC_LAST.result.cells:null;}
function dgSensGroupAreas(){return typeof DG_LC_LAST!=="undefined"?DG_LC_LAST?.result?.groupAreas||{}:{};}
function dgSensMeta(k){return window.DG_LC_VALIDATE?.labels?.[k]||{tr:window.DG_SURFACE_REVIEW?.types?.[k]?.label||k,emoji:""};}
function dgSensHa(a){return(Number(a||0)/10000).toFixed(2);}
function dgSensNewRecord(){const pk=dgSensParkId(),owner=typeof USER!=="undefined"?USER?.id:null;return{id:"surface-"+(owner||"guest")+"-"+(pk.id||"x"),owner,parkId:pk.id,parkName:pk.name,sens:{green:50,water:50,hard:50,bare:50},corrections:{},features:[],profile:null,period:"latest",createdAt:new Date().toISOString()};}
async function dgSensLoadRecord(){
 const fresh=dgSensNewRecord();let local=null,remote=null;
 try{const rows=await window.DG_LC_VALIDATE.loadCampaigns(fresh.parkId);local=rows.find(r=>r.id===fresh.id&&r.owner===fresh.owner);}catch(e){}
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
function dgSensDirty(){DG_SENS.editing=true;if(DG_SENS.record)DG_SENS.record.draftDirty=true;DG_SENS.status="";}
function dgSensPredict(sp){return window.DG_LC_VALIDATE.spectralPredict(sp,DG_SENS.record?.sens);}
function dgSensCellKey(c){return c.row+":"+c.col;}
function dgSensEffective(c){
 const rec=DG_SENS.record,key=dgSensCellKey(c),dec=rec?.corrections?.[key];
 if(dec&&(dec.method!=="sensitivity"||!DG_SENS.editing))return DG_SENS_CLASSES.includes(dec.to)?dec.to:c.classKey;
 if(!DG_SENS.editing)return c.classKey;
 if(Number(c.areaM2)<window.DG_LC_VALIDATE.defaults.edgeAreaM2)return c.classKey;
 const pred=dgSensPredict(rec?.profile?.cells?.[key]);
 return DG_SENS_CLASSES.includes(pred)?pred:c.classKey;
}
function dgSensCandidates(cls){return(dgSensCells()||[]).filter(c=>dgSensEffective(c)===cls&&c.classKey!==cls).map(cell=>({cell,pred:cls,sp:DG_SENS.record?.profile?.cells?.[dgSensCellKey(cell)]}));}
async function dgSensMount(hostId){
 const host=document.getElementById(hostId||"lcSens"),cells=dgSensCells();if(!host||!cells?.length)return;
 const epoch=++DG_SENS.epoch;DG_SENS.status="";dgSensGuard(true);
 const rec=await dgSensLoadRecord();if(epoch!==DG_SENS.epoch)return;
 const R=window.DG_SURFACE_REVIEW;
 const fingerprint=await R.fingerprint(cells,PARK_POLY,PARK_HOLES||[],{year:DG_LC_LAST.report?.year,engine:DG_LC_ENGINE_VERSION});if(epoch!==DG_SENS.epoch)return;
 if(rec.fingerprint&&rec.fingerprint!==fingerprint){Object.assign(rec,{corrections:{},features:[],profile:null,acceptedAt:null});DG_SENS.status=_tvs("Park sınırı veya veri değişti; eski kararlar yeni veriye uygulanmadı.");}
 rec.fingerprint=fingerprint;
 if(rec.profile?.radiometryVersion!=="pb04-offset-v1")rec.profile=null;
 DG_SENS.record=rec;DG_SENS.revision=rec.serverRevision||0;DG_SENS.editing=!!rec.draftDirty||!rec.acceptedAt;DG_SENS.focus=null;DG_SENS.showCand=true;
 DG_SENS.epsg=cells[0].epsg;
 DG_SENS.parkGeometry=R.park(PARK_POLY,PARK_HOLES||[],DG_SENS.epsg);
 DG_SENS.geometry={};for(const c of cells)DG_SENS.geometry[dgSensCellKey(c)]=R.cell(c,DG_SENS.parkGeometry,DG_SENS.epsg);
 DG_SENS.hostParent=host.parentNode;DG_SENS.hostNext=host.nextSibling;
 const mapEl=document.getElementById("map");
 if(mapEl){mapEl.after(host);mapEl.classList.add("surface-review-map");}
 host.style.display="block";
 dgSensGuard(true); /* 0056: analiz başladı — park algılama duraklatıldı */
 if(typeof DG_LC_LAYER!=="undefined"&&DG_LC_LAYER&&map.hasLayer(DG_LC_LAYER)){DG_SENS.baselineShown=true;map.removeLayer(DG_LC_LAYER);}
 if(DG_SENS.base!=="sat"&&typeof switchBaseLayer==="function"){switchBaseLayer("sat");DG_SENS.base="sat";}
 else if(typeof switchBaseLayer==="function")switchBaseLayer("sat");
 map.on("moveend",dgSensRefreshLayer);
 dgSensRender();dgSensRefreshLayer();
 host.scrollIntoView({block:"nearest"});
}
function dgSensAreas(){
 if(!DG_SENS.record||!DG_SENS.geometry)return null;
 return window.DG_SURFACE_REVIEW.summarize(dgSensGroupAreas(),dgSensCells(),dgSensEffective,DG_SENS.geometry,DG_SENS.record.features,DG_SENS.epsg,DG_SENS.parkGeometry);
}
function dgSensAdjusted(){const a=dgSensAreas();if(!a)return null;const rec=DG_SENS.record,n=Object.keys(rec.corrections).length;return{raster:dgSensGroupAreas(),corrected:a,n,nCorrected:n,nConfirmed:0};}
function dgSensRender(){
 const host=document.getElementById("lcSens"),rec=DG_SENS.record;if(!host||!rec)return;
 const scanned=!!rec.profile?.cells,disabled=DG_SENS.busy||DG_SENS.saving;
 let h=`<div class="dg-sens-head"><div><div class="dg-png-kicker">🛰 ${esc(_tvs("Yüzey düzenleme"))}</div><p class="dg-sens-hint">${esc(_tvs("Tara, haritada ayarla, doğru gördüğün sonucu kaydet."))}</p></div><button id="dgSensScanBtn" type="button" class="dg-png-btn ${scanned?"ghost":"primary"} sm" onclick="dgSensScan()" ${disabled?"disabled":""}>${DG_SENS.busy?"⏳":scanned?"🔁":"🔍"} ${esc(_tvs(scanned?"Yeniden Tara":"Tara"))}</button></div>`;
 if(scanned){
  const dates=(rec.profile.scenes||[]).filter(s=>s.usedCells>0).map(s=>s.datetime).sort();
  h+=`<p class="dg-sens-hint">Sentinel‑2 L2A · ${esc(dates[0]||"—")} – ${esc(dates.at(-1)||"—")} · ${rec.profile.stats?.nProfiled||0}/${dgSensCells().length} ${esc(_tvs("hücre"))} · 10 / 20 m</p>`;
 }
 h+=`<p class="dg-sens-hint">${esc(_tvs("Uydu altlığının tarihi bu tarihlerden farklı olabilir. Küçük bina ve havuzlar için sınır düzeltmesini kullanın."))}</p>`;
 for(const k of DG_SENS_CLASSES){const m=dgSensMeta(k);h+=`<div class="dg-sens-row"><button type="button" class="dg-sens-label" onclick="dgSensFocus('${k}')" aria-pressed="${DG_SENS.focus===k}">${m.emoji} ${esc(_tvs(m.tr))}</button><input id="dgSensRange-${k}" type="range" class="dg-sens-slider" min="0" max="100" step="1" value="${rec.sens[k]}" oninput="dgSensSlide('${k}',this.value)" aria-label="${esc(_tvs(m.tr))} ${esc(_tvs("hassasiyet"))}" ${!scanned||disabled?"disabled":""}><output class="dg-sens-count" id="dgSensCnt-${k}"></output></div>`;}
 h+=`<div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost sm" onclick="dgSensFocus(null)">${esc(_tvs("Tüm sınıflar"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensToggleCand(!DG_SENS.showCand)">${esc(_tvs(DG_SENS.showCand?"Görüntüyü göster":"Renkleri göster"))}</button><button type="button" class="dg-png-btn primary" id="dgSensAcceptBtn" onclick="dgSensAccept()" ${disabled?"disabled":""}>💾 ${esc(_tvs("Kabul et ve kaydet"))}</button></div><div id="dgSensSummary" class="dg-sens-adj"></div><p id="dgSensStatus" class="dg-sens-hint" role="status"></p>`;
 h+=`<details class="dg-sens-details"><summary>${esc(_tvs("Bina / havuz sınırını düzelt"))}</summary><p class="dg-sens-hint">${esc(_tvs("Sınıfı seç, haritada sınır köşelerine dokun, çizimi tamamla. Çizilen alan park sınırına kırpılır."))}</p><select id="dgSensDrawType" aria-label="${esc(_tvs("Yüzey türü"))}">${["building","pool","hard","water","green","bare"].map(k=>`<option value="${k}">${esc(_tvs(window.DG_SURFACE_REVIEW.types[k].label))}</option>`).join("")}</select><div class="dg-sens-actions"><button type="button" class="dg-png-btn blue sm" onclick="dgSensDrawStart()">✏ ${esc(_tvs("Sınır çiz"))}</button><button type="button" class="dg-png-btn primary sm" onclick="dgSensDrawFinish()">✓ ${esc(_tvs("Çizimi tamamla"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensDrawBack()">↩ ${esc(_tvs("Son köşeyi sil"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensDrawCancel()">${esc(_tvs("İptal"))}</button></div><div id="dgSensFeatures">${(rec.features||[]).map((f,i)=>`<div class="dg-sens-feature"><span>${esc(_tvs(window.DG_SURFACE_REVIEW.types[f.type]?.label||f.type))}</span><button type="button" class="dg-png-btn ghost sm" onclick="dgSensRemoveFeature(${i})">↩ ${esc(_tvs("Geri al"))}</button></div>`).join("")}</div></details>`;
 h+=`<details class="dg-sens-details"><summary>${esc(_tvs("Veri ve ayarlar"))}</summary><p class="dg-sens-hint">${esc(_tvs("Kaydırıcı eşikleri değiştirir; çözünürlüğü veya doğruluk garantisini artırmaz. Kabul, görsel inceleme kararınızı kaydeder."))}</p><label class="dg-png-label" for="dgSensPeriod">${esc(_tvs("DÖNEM"))}</label><select id="dgSensPeriod" onchange="dgSensPeriod(this.value)"><option value="latest" ${rec.period==="latest"?"selected":""}>${esc(_tvs("Son 120 gün"))}</option><option value="ref" ${rec.period==="ref"?"selected":""}>2021</option></select><div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost sm" onclick="dgSensModePark()">🌳 ${esc(_tvs("Park seç"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensModeAnalysis()">🛰 ${esc(_tvs("Analiz"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensExportGeoJson()">📥 GeoJSON</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensExportCsv()">📥 CSV</button><button type="button" class="dg-png-btn red sm" onclick="dgSensReset()">${esc(_tvs("Kararları sıfırla"))}</button></div></details>`;
 host.innerHTML=h;dgSensUpdateSummary();dgSensUpdateStatus();
}
function dgSensUpdateSummary(){
 const a=dgSensAreas(),rec=DG_SENS.record;if(!a||!rec)return;
 for(const k of DG_SENS_CLASSES){const el=document.getElementById("dgSensCnt-"+k);if(el)el.textContent=rec.sens[k]+" · "+dgSensHa(a[k])+" ha";}
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
  if(DG_SENS.base!=="sat"&&typeof switchBaseLayer==="function"){switchBaseLayer("sat");DG_SENS.base="sat";}
  await dgSensSave();
 }catch(e){if(epoch===DG_SENS.epoch){DG_SENS.status=_tvs("Tarama başarısız: ")+String(e.message||e);toast(DG_SENS.status,"err");}}
 finally{if(epoch===DG_SENS.epoch){DG_SENS.busy=false;dgSensRender();dgSensRefreshLayer();}}
}
function dgSensPeriod(v){if(DG_SENS.busy||DG_SENS.saving)return;DG_SENS.record.period=v==="ref"?"ref":"latest";dgSensScan();}
function dgSensSlide(cls,val){
 const rec=DG_SENS.record;if(!rec||DG_SENS.busy||DG_SENS.saving||!DG_SENS_CLASSES.includes(cls))return;
 const n=Number(val);rec.sens[cls]=Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;
 dgSensDirty();DG_SENS.focus=cls;DG_SENS.showCand=true;DG_SENS.status="";
 clearTimeout(DG_SENS.debounce);DG_SENS.debounce=setTimeout(()=>{dgSensRefreshLayer();dgSensUpdateSummary();dgSensUpdateStatus();dgSensSave();},60);
}
function dgSensFocus(cls){DG_SENS.focus=cls;dgSensRefreshLayer();}
function dgSensToggleCand(on){DG_SENS.showCand=!!on;dgSensRefreshLayer();dgSensRender();}
function dgSensBase(){DG_SENS.base=DG_SENS.base==="sat"?"osm":"sat";switchBaseLayer(DG_SENS.base);}
function dgSensRefreshLayer(){
 if(typeof map==="undefined"||!map||!window.L)return;
 if(DG_SENS.layer){map.removeLayer(DG_SENS.layer);DG_SENS.layer=null;}
 if(!DG_SENS.record||!DG_SENS.geometry||!DG_SENS.showCand)return;
 DG_SENS.layer=L.layerGroup().addTo(map);const renderer=L.canvas({padding:.25}),bounds=map.getBounds();
 const parts=window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,DG_SENS.geometry,DG_SENS.record.features,DG_SENS.epsg,DG_SENS.parkGeometry);
 for(const part of parts){
  if(DG_SENS.focus&&part.group!==DG_SENS.focus)continue;
  const key=part.key,cls=part.type;
  const wgs=dgSurfaceUnproject(part.geom,DG_SENS.epsg),points=wgs.flat(2).map(p=>[p[1],p[0]]);
  if(!bounds.intersects(L.latLngBounds(points)))continue;
  const latlngs=wgs.map(poly=>poly.map(r=>r.map(p=>[p[1],p[0]])));
  const poly=L.polygon(latlngs,{renderer,color:DG_SENS_COLORS[cls]||DG_SENS_COLORS.other,weight:part.method==="visual-boundary"?1.5:.4,fillColor:DG_SENS_COLORS[cls]||DG_SENS_COLORS.other,fillOpacity:DG_SENS.editing?.32:.45,bubblingMouseEvents:false});
  poly.on("click",ev=>{
   const oe=ev.originalEvent||ev;if(oe&&L.DomEvent?.stopPropagation)L.DomEvent.stopPropagation(oe);
   if(DG_SENS.draw){dgSensDrawPoint(ev);return;}dgSensPopup(key);
  });poly.addTo(DG_SENS.layer);
 }
}
function dgSensPopup(key){
 const c=dgSensCells()?.find(c=>dgSensCellKey(c)===key);if(!c)return;
 const cls=dgSensEffective(c),dec=DG_SENS.record.corrections[key];
 let html=`<div class="dg-sens-popup"><b>${esc(_tvs(dgSensMeta(cls).tr))}</b> · ${Number(c.areaM2).toFixed(1)} m²<p>${esc(_tvs("Görüntüdeki sınıfı seçerek bu hücreyi düzeltin."))}</p><div class="dg-sens-actions">`;
 for(const k of DG_SENS_CLASSES)html+=`<button type="button" class="dg-png-btn ${k===cls?"primary":"ghost"} sm" onclick="dgSensDecide('${key}','${k}')">${dgSensMeta(k).emoji} ${esc(_tvs(dgSensMeta(k).tr))}</button>`;
 if(dec)html+=`<button type="button" class="dg-png-btn ghost sm" onclick="dgSensUndo('${key}')">↩ ${esc(_tvs("Geri al"))}</button>`;
 html+="</div></div>";L.popup({maxWidth:280}).setLatLng([c.center.lat,c.center.lon]).setContent(html).openOn(map);
}
function dgSensDecide(key,toCls){
 const c=dgSensCells()?.find(c=>dgSensCellKey(c)===key);if(!c||!DG_SENS_CLASSES.includes(toCls)||DG_SENS.saving)return;
 DG_SENS.record.corrections[key]={from:c.classKey,to:toCls,method:"visual-cell",ts:new Date().toISOString()};dgSensDirty();map.closePopup();dgSensRefreshLayer();dgSensUpdateSummary();dgSensUpdateStatus();dgSensSave();
}
function dgSensUndo(key){if(!DG_SENS.record||DG_SENS.saving)return;delete DG_SENS.record.corrections[key];dgSensDirty();map.closePopup();dgSensRefreshLayer();dgSensUpdateSummary();dgSensSave();}
function dgSensBulk(cls){for(const x of dgSensCandidates(cls))dgSensDecide(dgSensCellKey(x.cell),cls);}
async function dgSensAccept(){
 const rec=DG_SENS.record;if(!rec||DG_SENS.saving||DG_SENS.busy||DG_SENS.draw)return;
 if(!rec.profile&&!rec.features.length&&!Object.keys(rec.corrections).length){toast(_tvs("Önce tarama veya sınır düzeltmesi yapın."),"warn");return;}
 const epoch=DG_SENS.epoch,snapshot=JSON.parse(JSON.stringify(rec));
 for(const c of dgSensCells()){const key=dgSensCellKey(c);if(snapshot.corrections[key]?.method!=="visual-cell")snapshot.corrections[key]={from:c.classKey,to:dgSensEffective(c),method:"sensitivity",ts:new Date().toISOString()};}
 snapshot.draftDirty=false;snapshot.acceptedAreas=dgSensAreas();snapshot.acceptedAt=new Date().toISOString();snapshot.modifiedAt=snapshot.acceptedAt;
 DG_SENS.saving=true;dgSensRender();
 try{
  if(!snapshot.owner||!snapshot.parkId)throw Error(_tvs("Hesaba kaydetmek için giriş yapın ve kayıtlı bir park seçin."));
  const revision=await window.DG_SURFACE_REVIEW.save(snapshot,DG_SENS.revision);
  if(epoch!==DG_SENS.epoch)return;
  DG_SENS.record=snapshot;DG_SENS.revision=revision;DG_SENS.editing=false;DG_SENS.focus=null;
  const cached=await dgSensSave();DG_SENS.status=_tvs("✓ Sonuç hesabınıza kaydedildi; başka cihazda da açılabilir.")+(cached?"":" · "+_tvs("Cihaz önbelleği yazılamadı."));
  toast(DG_SENS.status,"ok");
 }catch(e){if(epoch===DG_SENS.epoch){const local=await dgSensSave();DG_SENS.status=_tvs("Hesaba kaydedilemedi: ")+String(e.message||e)+(local?" · "+_tvs("Taslak bu cihazda saklandı."):"");toast(DG_SENS.status,"err");}}
 finally{if(epoch===DG_SENS.epoch){DG_SENS.saving=false;dgSensRender();dgSensRefreshLayer();}}
}
function dgSensReset(){if(DG_SENS.saving||!confirm(_tvs("Tüm kararlar silinsin mi? (Tarama profili kalır)")))return;DG_SENS.record.corrections={};DG_SENS.record.features=[];dgSensDirty();dgSensRefreshLayer();dgSensRender();dgSensSave();}
function dgSensDrawStart(){if(DG_SENS.saving)return;dgSensDrawCancel();DG_SENS.draw={type:document.getElementById("dgSensDrawType").value,ring:[]};DG_SENS.status=_tvs("Haritada sınır köşelerine dokunun; ardından çizimi tamamlayın.");dgSensUpdateStatus();dgSensGuard(true);map.on("click",dgSensDrawPoint);}
function dgSensDrawPoint(ev){if(!DG_SENS.draw||!ev.latlng)return;const p=[ev.latlng.lng,ev.latlng.lat];if(DG_SENS.draw.ring.length>=300)return;DG_SENS.draw.ring.push(p);dgSensDrawRender();}
function dgSensDrawRender(){if(DG_SENS.drawLayer)map.removeLayer(DG_SENS.drawLayer);DG_SENS.drawLayer=L.layerGroup().addTo(map);const pts=DG_SENS.draw.ring.map(p=>[p[1],p[0]]);if(pts.length>1)L.polyline(pts,{color:DG_SENS_COLORS[DG_SENS.draw.type],dashArray:"4,4",interactive:false}).addTo(DG_SENS.drawLayer);for(const p of pts)L.circleMarker(p,{radius:5,color:DG_SENS_COLORS[DG_SENS.draw.type],interactive:false}).addTo(DG_SENS.drawLayer);}
function dgSensDrawBack(){if(DG_SENS.draw){DG_SENS.draw.ring.pop();dgSensDrawRender();}}
function dgSensDrawCancel(){if(DG_SENS.drawLayer)map.removeLayer(DG_SENS.drawLayer);DG_SENS.drawLayer=null;DG_SENS.draw=null;map.off("click",dgSensDrawPoint);}
function dgSensDrawFinish(){
 const d=DG_SENS.draw;if(!d)return;
 if(!window.DG_SURFACE_REVIEW.validRing(d.ring)){toast(_tvs("En az üç köşe seçin; sınır kendi üzerine kesişmemeli."),"warn");return;}
 const geom=window.polygonClipping.intersection([dgSurfaceProject(d.ring,DG_SENS.epsg)],DG_SENS.parkGeometry);
 if(dgSurfaceArea(geom)<.1){toast(_tvs("Çizim park sınırının dışında veya çok küçük."),"warn");return;}
 DG_SENS.record.features.push({...d,method:"visual-boundary",ts:new Date().toISOString()});dgSensDirty();dgSensDrawCancel();dgSensRefreshLayer();dgSensRender();dgSensSave();
}
function dgSensRemoveFeature(i){if(DG_SENS.saving)return;DG_SENS.record.features.splice(i,1);dgSensDirty();dgSensRefreshLayer();dgSensRender();dgSensSave();}
function dgSensExportGeoJson(){
 const rec=DG_SENS.record;if(!rec)return;
 const parts=window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,DG_SENS.geometry,rec.features,DG_SENS.epsg,DG_SENS.parkGeometry);
 const features=parts.map(p=>({type:"Feature",properties:{row:p.cell.row,column:p.cell.col,original_class:p.cell.classKey,review_class:p.type,group:p.group,area_m2:p.areaM2,method:p.method,source_fingerprint:rec.fingerprint,accepted_at:rec.acceptedAt||null,view:DG_SENS.editing?"preview":"accepted"},geometry:{type:"MultiPolygon",coordinates:dgSurfaceUnproject(p.geom,DG_SENS.epsg)}}));
 downloadBlob("dendrogeo_surface_"+rec.parkId+".geojson","application/geo+json",JSON.stringify({type:"FeatureCollection",features}));
}
function dgSensExportCsv(){const a=dgSensAreas();if(!a)return;const rec=DG_SENS.record;downloadBlob("dendrogeo_surface_"+rec.parkId+".csv","text/csv;charset=utf-8","\uFEFFclass,area_m2,area_ha,view,source_fingerprint\n"+Object.keys(a).map(k=>[k,a[k],a[k]/10000,DG_SENS.editing?"preview":"accepted",rec.fingerprint].join(",")).join("\n"));}
function dgSensCleanup(){
 ++DG_SENS.epoch;clearTimeout(DG_SENS.debounce);
 if(typeof map!=="undefined"&&map){if(DG_SENS.layer)map.removeLayer(DG_SENS.layer);dgSensDrawCancel();map.off("moveend",dgSensRefreshLayer);}
 const host=document.getElementById("lcSens");if(host){host.style.display="none";host.innerHTML="";if(DG_SENS.hostParent?.isConnected)DG_SENS.hostParent.insertBefore(host,DG_SENS.hostNext?.parentNode===DG_SENS.hostParent?DG_SENS.hostNext:null);else host.remove();}
 document.getElementById("map")?.classList.remove("surface-review-map");
 Object.assign(DG_SENS,{record:null,layer:null,geometry:null,parkGeometry:null,busy:false,saving:false,baselineShown:false,hostParent:null,hostNext:null});
 dgSensGuard(false); /* 0056: park kapandı — algılama serbest */
}
window.DG_LC_SENS={mount:dgSensMount,cleanup:dgSensCleanup,guard:dgSensGuard,state:DG_SENS};
