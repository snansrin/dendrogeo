"use strict";
/* Mobile surface review: one raster baseline → manual review → explicit acceptance.
 * Raster baseline stays read-only. Geometry clipping and cloud persistence
 * are isolated in lc-review.js. Accepted snapshots are bound to source/grid. */
const _tvs=s=>typeof dgCf==="function"?dgCf(s):s;
const _tvst=(s,v)=>typeof dgTfs==="function"?dgTfs(s,v):s.replace(/\{(\w+)\}/g,(m,k)=>v[k]??m);
const DG_SENS={record:null,layer:null,busy:false,saving:false,showCand:true,base:"sat",guard:true,debounce:null,epoch:0,focus:null,editing:true,revision:0,geometry:null,parkGeometry:null,epsg:null,hostParent:null,hostNext:null,status:"",draw:null,drawLayer:null,objectPick:false,objectPreview:null,objectPreviewLayer:null,localQueue:Promise.resolve(),opacity:45,visualVersion:0,baselineShown:false,rawView:false,brush:null,rightPan:null,brushType:"hard",brushDiameter:10,strokeSeq:0,drawType:"building",vegetationView:false};
const DG_SENS_COLORS={green:"#22c55e",water:"#3b82f6",hard:"#64748b",bare:"#8b5a2b",building:"#475569",pool:"#0ea5e9",other:"#94a3b8"};
const DG_SENS_VEGETATION_COLORS={sparse:"#b7e4a8",moderate:"#4caf66",dense:"#14532d"};
const DG_SENS_CLASSES=["green","water","hard","bare"];
function dgSensGuard(on){DG_SENS.guard=!!on;window._dgSensGuard=!!on;}
function dgSensModeAnalysis(){dgSensGuard(true);dgSensRender();}
function dgSensModePark(){
  dgSensGuard(false);
  dgSensBrushStop();
  if(DG_SENS.draw)dgSensDrawCancel();
  dgSensObjectCancel();
  if(typeof PARK_MODE!=="undefined"&&!PARK_MODE&&typeof toggleParkMode==="function")toggleParkMode();
  dgSensRender();
}
function dgSensParkId(){try{if(typeof DG_PARK!=="undefined"&&DG_PARK?.id)return{id:DG_PARK.id,name:DG_PARK.name||""};}catch(e){}return{id:null,name:""};}
function dgSensCells(){return typeof DG_LC_LAST!=="undefined"&&Array.isArray(DG_LC_LAST?.result?.cells)?DG_LC_LAST.result.cells:null;}
function dgSensGroupAreas(){return typeof DG_LC_LAST!=="undefined"?DG_LC_LAST?.result?.groupAreas||{}:{};}
function dgSensEditSummary(rec=DG_SENS.record,cells=dgSensCells()||[]){
 if(DG_SENS.rawView||!rec)return{total:0,manualCells:0,sensitivityCells:0,boundaries:0,thresholds:0,appearance:0};
 const manualCells=Object.values(rec.corrections||{}).filter(d=>d.method==="visual-cell").length;
 const sensitivityCells=cells.filter(c=>{const d=rec.corrections?.[dgSensCellKey(c)];if(d?.method==="visual-cell")return false;const type=rec===DG_SENS.record?dgSensEffective(c):(d?.to||c.rasterClassKey||c.classKey);return type!==(c.rasterClassKey||c.classKey);}).length;
 const boundaries=(rec.features||[]).length,thresholds=DG_SENS_CLASSES.filter(k=>Number(rec.sens?.[k]??50)!==50).length,appearance=Number(rec.displayOpacity??45)!==45?1:0;
 return{manualCells,sensitivityCells,boundaries,thresholds,appearance,total:manualCells+sensitivityCells+boundaries+thresholds+appearance};
}
function dgSensMeta(k){return window.DG_LC_VALIDATE?.labels?.[k]||{tr:window.DG_SURFACE_REVIEW?.types?.[k]?.label||k,emoji:""};}
/* Park-relative NDVI terciles describe spectral greenness within the mapped
 * green class. They are a display aid, not canopy cover, a new raster class,
 * or an area adjustment. Require three distinct observations per cell. */
function dgSensVegetationTiers(){
 const cells=dgSensCells()||[],profile=DG_SENS.record?.profile?.cells;
 if(!profile)return{tiers:new Map(),count:0,eligible:0,cutoffs:null};
 const candidates=[];
 for(const cell of cells){
  if(dgSensEffective(cell)!=="green")continue;
  const e=profile[dgSensCellKey(cell)],value=e?.ndviMedianYear==null?NaN:Number(e.ndviMedianYear),obs=Number(e?.ndviObs??e?.yearObs??e?.obs??0);
  if(Number.isFinite(value)&&obs>=3)candidates.push({key:dgSensCellKey(cell),value});
 }
 candidates.sort((a,b)=>a.value-b.value||a.key.localeCompare(b.key));
 const tiers=new Map(),n=candidates.length;let cutoffs=null;
 if(n>=9){
  const quantile=q=>{const at=(n-1)*q,lo=Math.floor(at),hi=Math.ceil(at);return candidates[lo].value+(candidates[hi].value-candidates[lo].value)*(at-lo);};
  cutoffs=[quantile(1/3),quantile(2/3)];
  for(const item of candidates)tiers.set(item.key,item.value<=cutoffs[0]?"sparse":item.value<=cutoffs[1]?"moderate":"dense");
 }
 return{tiers,count:n,eligible:cells.filter(c=>dgSensEffective(c)==="green").length,cutoffs};
}
function dgSensToggleVegetation(on){DG_SENS.vegetationView=!!on;DG_SENS.vegetationRenderKey=null;DG_SENS.vegetationLayer?.clearLayers();dgSensRefreshLayer();dgSensUpdateSummary();dgSensRenderPaintTools();}
async function dgSensRenderVegetation(){
 const result=dgSensVegetationTiers(),rec=DG_SENS.record;
 if(!DG_SENS.vegetationView||!rec||!DG_SENS.geometry||result.count<9||(DG_SENS.focus&&DG_SENS.focus!=="green")){DG_SENS.vegetationLayer?.clearLayers();return;}
 const key=[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,result.count,DG_SENS.vegetationView].join(":");
 if(DG_SENS.vegetationRenderKey===key||DG_SENS.vegetationRenderBusy)return;
 DG_SENS.vegetationRenderBusy=true;const epoch=DG_SENS.epoch;
 try{
  const cells=dgSensCells()||[],parts=[];
  for(const c of cells){const tier=result.tiers.get(dgSensCellKey(c)),geom=DG_SENS.geometry[dgSensCellKey(c)];if(tier&&geom?.length)parts.push({type:tier,geom,areaM2:Number(c.areaM2)||0});}
  const job=await dgSurfaceWorkerJob({job:"merge",parts,epsg:DG_SENS.epsg,display:true,park:DG_SENS.parkGeometry});
  if(epoch!==DG_SENS.epoch||!DG_SENS.vegetationView||key!==[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,result.count,DG_SENS.vegetationView].join(":"))return;
  const features=job?.displayFeatures||dgSurfaceDisplaySync(parts,DG_SENS.epsg,DG_SENS.parkGeometry,job?.features||dgSurfaceMergeSync(parts,DG_SENS.epsg));
  if(!DG_SENS.vegetationLayer)DG_SENS.vegetationLayer=L.layerGroup().addTo(map);
  DG_SENS.vegetationLayer.clearLayers();
  for(const f of features){const cls=f.properties.class,rings=f.geometry.coordinates.map(poly=>poly.map(r=>r.map(p=>[p[1],p[0]])));L.polygon(rings,{renderer:DG_SENS.renderer,stroke:false,weight:0,interactive:false,fillColor:DG_SENS_VEGETATION_COLORS[cls]||DG_SENS_VEGETATION_COLORS.moderate,fillOpacity:DG_SENS.opacity/100}).addTo(DG_SENS.vegetationLayer);}
  DG_SENS.vegetationRenderKey=key;
 }catch(e){DG_SENS.status=_tvs("NDVI görünümü hazırlanamadı: ")+String(e.message||e);dgSensUpdateStatus();}
 finally{DG_SENS.vegetationRenderBusy=false;if(DG_SENS.vegetationView&&DG_SENS.geometry&&key!==[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,dgSensVegetationTiers().count,DG_SENS.vegetationView].join(":"))setTimeout(dgSensRenderVegetation,0);}
}
function dgSensHa(a){return(Number(a||0)/10000).toFixed(3);}
function dgSensNewRecord(){const pk=dgSensParkId(),owner=typeof USER!=="undefined"?USER?.id:null;return{id:"surface-"+(owner||"guest")+"-"+(pk.id||"x"),owner,parkId:pk.id,parkName:pk.name,sens:{green:50,water:50,hard:50,bare:50},corrections:{},features:[],useObjects:true,spectralEnabled:false,analysisEngine:"esa-raster-manual-v1",profile:null,period:"latest",createdAt:new Date().toISOString()};}
function dgSensResetScanState(rec){if(!rec)return;rec.sens={green:50,water:50,hard:50,bare:50};rec.spectralEnabled=false;rec.profile=null;}
function dgSensMigrateOsmObjects(rec){if(!rec)return false;const stale=(!!rec.objectVersion&&rec.objectVersion!=="footprints-v3-area-semantics")||((rec.objectFeatures||[]).length>0&&rec.objectVersion!=="footprints-v3-area-semantics");if(!stale)return false;rec.objectFeatures=null;rec.objectVersion=null;rec.draftDirty=true;return true;}
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
 return{...fresh,...safe,serverRevision:revision,sens,corrections:safe.corrections&&typeof safe.corrections==="object"&&!Array.isArray(safe.corrections)?safe.corrections:{},features:Array.isArray(safe.features)?safe.features.filter(f=>window.DG_SURFACE_REVIEW.validFeature(f)):[]};
}
function dgSensSave(){
 if(!DG_SENS.record)return Promise.resolve(false);
 DG_SENS.record.modifiedAt=new Date().toISOString();
 const snapshot=typeof structuredClone==="function"?structuredClone(DG_SENS.record):JSON.parse(JSON.stringify(DG_SENS.record));
 const job=DG_SENS.localQueue.catch(()=>{}).then(()=>window.DG_LC_VALIDATE.saveCampaign(snapshot));
 DG_SENS.localQueue=job;
 return job.then(()=>true).catch(()=>{if(DG_SENS.record?.id===snapshot.id){DG_SENS.status=_tvs("Cihaz kaydı başarısız. Kaydet düğmesiyle hesap kaydını deneyin.");dgSensUpdateStatus();}return false;});
}
function dgSensDirty(){DG_SENS.visualVersion++;DG_SENS.editing=true;if(DG_SENS.record)DG_SENS.record.draftDirty=true;DG_SENS.status="";}
function dgSensPredict(sp){return window.DG_LC_VALIDATE.spectralPredict(sp,DG_SENS.record?.sens);}
function dgSensCellKey(c){return c.row+":"+c.col;}
function dgSensEffective(c){
 const original=c.rasterClassKey||c.classKey;
 if(DG_SENS.rawView)return original;
 const dec=DG_SENS.record?.corrections?.[dgSensCellKey(c)];
 // Manual cells and accepted decisions take precedence over optional spectral review.
 if(dec&&(dec.method==="visual-cell"||!DG_SENS.editing))return window.DG_SURFACE_REVIEW.types[dec.to]?dec.to:original;
 if(!DG_SENS.editing||!DG_SENS.record?.spectralEnabled||Number(c.areaM2)<window.DG_LC_VALIDATE.defaults.edgeAreaM2)return original;
 const sens=DG_SENS.record.sens;
 if(!DG_SENS_CLASSES.some(k=>Number(sens[k])!==50))return original;
 const pred=dgSensPredict(DG_SENS.record.profile?.cells?.[dgSensCellKey(c)]);
 if(!DG_SENS_CLASSES.includes(pred))return original;
 // A slider cannot silently relabel unrelated classes at their default thresholds.
 return Number(sens[pred])!==50||Number(sens[original])!==50?pred:original;
}
function dgSensCandidates(cls){return(dgSensCells()||[]).filter(c=>dgSensEffective(c)===cls&&c.classKey!==cls).map(cell=>({cell,pred:cls,sp:DG_SENS.record?.profile?.cells?.[dgSensCellKey(cell)]}));}
async function dgSensMount(hostId){
 const host=document.getElementById(hostId||"lcSens"),cells=dgSensCells();if(!host||!cells?.length)return;
 dgSensBrushStop();DG_SENS.rawView=false;const epoch=++DG_SENS.epoch;DG_SENS.status="";dgSensGuard(true);
 const rec=await dgSensLoadRecord();if(epoch!==DG_SENS.epoch)return;
 const R=window.DG_SURFACE_REVIEW;
 const fingerprint=await R.fingerprint(cells,PARK_POLY,PARK_HOLES||[],{year:DG_LC_LAST.report?.year,engine:DG_LC_ENGINE_VERSION});if(epoch!==DG_SENS.epoch)return;
 if(rec.fingerprint&&rec.fingerprint!==fingerprint){Object.assign(rec,{corrections:{},features:[],objectFeatures:null,profile:null,acceptedAt:null,acceptedAreas:null,acceptedResult:null});DG_SENS.status=_tvs("Park sınırı veya veri değişti; eski kararlar yeni veriye uygulanmadı.");}
 rec.fingerprint=fingerprint;
 // A new park analysis always starts with a fresh optional scan and neutral thresholds.
 // Accepted publication snapshots remain immutable in acceptedResult.
 dgSensResetScanState(rec);
 const rebuildOsmObjects=dgSensMigrateOsmObjects(rec);
 if(rebuildOsmObjects)DG_SENS.status=_tvs("OSM yüzey geometrileri yeni alan kurallarıyla yeniden hesaplanıyor; önceki kabul edilmiş rapor korunuyor.");
 DG_SENS.record=rec;DG_SENS.opacity=rec.displayOpacity??45;DG_SENS.revision=rec.serverRevision||0;DG_SENS.editing=!!rec.draftDirty||!rec.acceptedAt||!rec.acceptedResult;
 if(rec.acceptedAt&&!rec.acceptedResult)DG_SENS.status=_tvs("Önceki kabul alanları hesabınızda korunuyor. Bu yeni harita önizlemesini kontrol edip kaydedin.");DG_SENS.focus=null;DG_SENS.showCand=true;
 DG_SENS.epsg=cells[0].epsg;
 DG_SENS.hostParent=host.parentNode;DG_SENS.hostNext=host.nextSibling;
 const mapEl=document.getElementById("map");
 if(mapEl){(document.getElementById("surfaceMapWorkspace")||mapEl).after(host);mapEl.classList.add("surface-review-map");}
 host.style.display="block";
 dgSensGuard(true); /* 0056: analiz başladı — park algılama duraklatıldı */
 if(typeof DG_LC_LAYER!=="undefined"&&DG_LC_LAYER&&map.hasLayer(DG_LC_LAYER)){DG_SENS.baselineShown=true;map.removeLayer(DG_LC_LAYER);}
 DG_SENS.base=document.getElementById("baseLayerSelect")?.value||DG_SENS.base;
 if(typeof switchBaseLayer==="function")switchBaseLayer(DG_SENS.base);
 document.getElementById("v-map")?.classList.add("surface-review-active");
 map.invalidateSize({pan:false});
 if(typeof ResizeObserver!=="undefined"){DG_SENS.resizeObserver?.disconnect();DG_SENS.resizeObserver=new ResizeObserver(()=>map.invalidateSize({pan:false}));DG_SENS.resizeObserver.observe(mapEl);}
 // Leaflet canvas handles pan/zoom without recomputing or restyling geometry.
 const partitioned=await dgSensRepartition();if(epoch!==DG_SENS.epoch||!partitioned)return;if(rec.acceptedResult&&!DG_SENS.editing)dgSensRenderAccepted();
 const pending=document.getElementById("surfacePendingTools");if(pending)pending.style.display="none";
 host.scrollIntoView({block:"nearest"});
}
function dgSensParts(){
 const cells=dgSensCells(),geometry=DG_SENS.geometry,park=DG_SENS.parkGeometry,rec=DG_SENS.record;
 if(!rec||!geometry||!park||!Array.isArray(cells)||!cells.length){DG_SENS.partsMemo=null;return [];}
 const key=[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,DG_SENS.editing].join(":");
 const features=dgSensFeatures(),memo=DG_SENS.partsMemo,sens=JSON.stringify(rec.sens);
 if(memo?.key!==key||memo.geometry!==geometry||memo.record!==rec||memo.sens!==sens||memo.corrections!==rec.corrections||memo.profile!==rec.profile||memo.features.length!==features.length||!memo.features.every((f,i)=>f===features[i])){
  const parts=window.DG_SURFACE_REVIEW.resolved(cells,dgSensEffective,geometry,features,DG_SENS.epsg,park);
  DG_SENS.partsMemo={key,geometry,parts,record:rec,sens,corrections:rec.corrections,profile:rec.profile,features};
 }
 return DG_SENS.partsMemo.parts;
}
function dgSensLayerClickIsCurrent(epoch,geometry){return !!DG_SENS.record&&!DG_SENS.busy&&!!geometry&&DG_SENS.epoch===epoch&&DG_SENS.geometry===geometry;}
function dgSensAreas(){
 if(!DG_SENS.record||!DG_SENS.geometry)return null;
 const parts=dgSensParts(),memo=DG_SENS.partsMemo;
 return memo.areas||(memo.areas=dgSurfaceSummarizeParts(dgSensGroupAreas(),parts));
}
async function dgSensVisualResult(parts=dgSensParts()){
 // Class labels, rather than slider positions, determine geometry. Identical
 // classifications reuse the same pending/completed worker result for preview,
 // acceptance and PNG export; styling never invalidates geometry.
 const key=[DG_SENS.epoch,DG_SENS.partitionVersion,parts.map(p=>p.type).join(",")].join(":");
 if(DG_SENS.visualMemo?.key===key&&DG_SENS.visualMemo.geometry===DG_SENS.geometry)return DG_SENS.visualMemo.promise;
 const epsg=DG_SENS.epsg,park=DG_SENS.parkGeometry,memo={key,geometry:DG_SENS.geometry};
 DG_SENS.visualMemo=memo;
 const accepted=DG_SENS.record?.acceptedResult;
 if(!DG_SENS.rawView&&!DG_SENS.editing&&!DG_SENS.record?.draftDirty&&accepted?.displayMethod?.version===4&&accepted.features?.length&&accepted.displayFeatures?.length===accepted.features.length){
  memo.promise=Promise.resolve({features:accepted.features,displayFeatures:accepted.displayFeatures});return memo.promise;
 }
 memo.promise=(async()=>{
  const job=await dgSurfaceWorkerJob({job:"merge",parts:parts.map(p=>({type:p.type,geom:p.geom,areaM2:p.areaM2,method:p.method})),epsg,display:true,park});
  const features=job?.features||dgSurfaceMergeSync(parts,epsg);
  return job||{features,displayFeatures:dgSurfaceDisplaySync(parts,epsg,park,features)};
 })().catch(e=>{if(DG_SENS.visualMemo===memo)DG_SENS.visualMemo=null;throw e;});
 return memo.promise;
}
function dgSensAdjusted(){const a=dgSensAreas();if(!a)return null;const rec=DG_SENS.record,n=Object.keys(rec.corrections).length;return{raster:dgSensGroupAreas(),corrected:a,n,nCorrected:n,nConfirmed:0};}
function dgSensRememberSection(el){DG_SENS.sections=DG_SENS.sections||{};DG_SENS.sections[el.id]=el.open;}
function dgSensRender(){
 const host=document.getElementById("lcSens"),rec=DG_SENS.record;if(!host||!rec)return;
 const scanned=!!rec.profile?.cells,vegReady=scanned&&dgSensVegetationTiers().count>=9,disabled=DG_SENS.busy||DG_SENS.saving||DG_SENS.exporting;
 let h=`<div class="dg-sens-head"><div><div class="dg-png-kicker">🛰 ${esc(_tvs("Yüzey düzenleme"))}</div><p class="dg-sens-hint">${esc(_tvs("Tara, haritada ayarla, doğru gördüğün sonucu kaydet."))}</p></div><button id="dgSensScanBtn" type="button" class="dg-png-btn ${scanned?"ghost":"primary"} sm" onclick="dgSensScan()" ${disabled||DG_SENS.rawView||DG_SENS.brush?"disabled":""}>${DG_SENS.busy?"⏳":scanned?"🔁":"🔍"} ${esc(_tvs(scanned?"Yeniden Tara":"Tara"))}</button></div>`;
 if(scanned){
  const dates=(rec.profile.scenes||[]).filter(s=>s.usedCells>0).map(s=>s.datetime).sort();
  h+=`<p class="dg-sens-hint">Sentinel‑2 L2A · ${esc(dates[0]||"—")} – ${esc(dates.at(-1)||"—")} · ${rec.profile.stats?.nProfiled||0}/${dgSensCells().length} ${esc(_tvs("hücre"))} · 10 / 20 m</p>`;
 }
 h+=`<p class="dg-sens-hint">${esc(_tvs("Uydu altlığının tarihi bu tarihlerden farklı olabilir. Küçük bina ve havuzlar için sınır düzeltmesini kullanın."))}</p>`;
 h+=`<details id="dgSensThresholdDetails" class="dg-sens-details" ontoggle="dgSensRememberSection(this)" ${DG_SENS.sections?.dgSensThresholdDetails?"open":""}><summary>${esc(_tvs("Hassasiyet barları"))}<span class="dg-paint-chevron" aria-hidden="true">⌄</span></summary>`;
 for(const k of DG_SENS_CLASSES){const m=dgSensMeta(k);h+=`<div class="dg-sens-row"><button type="button" class="dg-sens-label" onclick="dgSensFocus('${k}')" aria-pressed="${DG_SENS.focus===k}">${m.emoji} ${esc(_tvs(m.tr))}</button><input id="dgSensRange-${k}" type="range" class="dg-sens-slider" min="0" max="100" step="1" value="${rec.sens[k]}" oninput="dgSensSlide('${k}',this.value)" aria-label="${esc(_tvs(m.tr))} ${esc(_tvs("hassasiyet"))}" ${!scanned||disabled||DG_SENS.rawView||DG_SENS.brush?"disabled":""}><output class="dg-sens-count" id="dgSensCnt-${k}"></output></div>`;}
 h+=`<div class="dg-sens-row"><label class="dg-sens-label" for="dgSensOpacity">${esc(_tvs("Renk yoğunluğu"))}</label><input id="dgSensOpacity" type="range" class="dg-sens-slider" min="0" max="100" value="${DG_SENS.opacity}" oninput="dgSensOpacity(this.value)"><output class="dg-sens-count" id="dgSensOpacityValue">%${DG_SENS.opacity}</output></div>`;
 h+=`</details>`;
 h+=`<p class="dg-sens-hint">${esc(_tvs("Bina, su ve havuz sınırları ayrı vektör kanıtı olarak gösterilir."))} · OSM: ${(rec.objectFeatures||[]).length} ${esc(_tvs("nesne sınırı"))}</p><div id="dgSensVegetationSummary" class="dg-sens-hint" aria-live="polite"></div><div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost sm" onclick="dgSensFocus(null)">${esc(_tvs("Tüm sınıflar"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensToggleCand(!DG_SENS.showCand)">${esc(_tvs(DG_SENS.showCand?"Görüntüyü göster":"Renkleri göster"))}</button><button type="button" class="dg-png-btn primary" id="dgSensAcceptBtn" onclick="dgSensAccept()" ${disabled||DG_SENS.rawView||DG_SENS.brush?"disabled":""}>💾 ${esc(_tvs("Kabul et ve kaydet"))}</button></div><div id="dgSensSummary" class="dg-sens-adj"></div><p id="dgSensStatus" class="dg-sens-hint" role="status"></p>`;
 h+=`<div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost sm" onclick="dgSensRawView(!DG_SENS.rawView)" aria-pressed="${DG_SENS.rawView}" ${disabled?"disabled":""}>${esc(_tvs(DG_SENS.rawView?"Düzenlemeye dön":"Ham analizi göster"))}</button></div>`;
 h+=`<p class="dg-sens-hint">${esc(_tvs(DG_SENS.rawView?"Ham kaynak görüntüleniyor; kayıtlı düzeltmeler korunur. Düzenlemek veya kaydetmek için düzenlemeye dönün.":"Tarama isteğe bağlıdır. Ham analizi doğrudan inceleyebilir veya tarayıp hassasiyet barlarıyla ayarlayabilirsiniz."))}</p>`;

 host.innerHTML=h;
 dgSensRenderPaintTools();dgSensBindRightPan();dgSensUpdateSummary();dgSensUpdateStatus();
}
function dgSensRenderPaintTools(){
 const host=document.getElementById("surfaceBrushTools"),rec=DG_SENS.record;if(!host)return;
 if(typeof dgEditorClearMenus==="function")dgEditorClearMenus("surface");
 if(!rec){host.innerHTML="";return;}
 const viewDisabled=DG_SENS.busy||DG_SENS.saving||DG_SENS.exporting;
 const disabled=viewDisabled||DG_SENS.rawView;
 const scanned=!!rec.profile?.cells,vegReady=scanned&&dgSensVegetationTiers().count>=9;
 const types=["hard","green","water","building","pool","bare"],type=DG_SENS.brush?.type||DG_SENS.brushType;
 const label=window.DG_SURFACE_REVIEW.types[type].label,drawLabel=window.DG_SURFACE_REVIEW.types[DG_SENS.drawType]?.label||label;
 let menus=`<details data-menu-owner="surface" data-menu-order="10" class="dg-editor-menu" ontoggle="dgSensMenuToggle(this)"><summary>${esc(_tvs("Dosya"))}<span aria-hidden="true">⌄</span></summary><div class="dg-editor-menu-body dg-editor-file"><div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost sm" onclick="dgSensModePark()">🌳 ${esc(_tvs("Park seç"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensModeAnalysis()">🛰 ${esc(_tvs("Analiz"))}</button><button type="button" class="dg-png-btn primary sm" onclick="dgSensExportPng()">🖼️ ${esc(_tvs("Doğrulanmış Harita"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensExportGeoJson()">📥 GeoJSON</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensExportCsv()">📥 CSV</button><button type="button" class="dg-png-btn red sm" onclick="dgSensReset()">${esc(_tvs("Kararları sıfırla"))}</button></div></div></details>`;
 menus+=`<details data-menu-owner="surface" data-menu-order="20" class="dg-editor-menu" ontoggle="dgSensMenuToggle(this)"><summary>${esc(_tvs("Görünüm"))}<span aria-hidden="true">⌄</span></summary><div class="dg-editor-menu-body">${`<div class="dg-sens-map-tools"><label for="dgSensBaseSelect">${esc(_tvs("Harita"))}</label><select id="dgSensBaseSelect" onchange="dgSensBase(this.value)">${[["osm","Sokak"],["sat","Uydu"],["topo","Topoğrafik"]].map(([v,t])=>`<option value="${v}" ${DG_SENS.base===v?"selected":""}>${esc(_tvs(t))}</option>`).join("")}</select><button type="button" class="dg-png-btn ghost sm" onclick="dgChooseNewPark()">📍 ${esc(_tvs("Yeni konum"))}</button></div>`}<button type="button" class="dg-png-btn ghost sm" onclick="dgSensRawView(!DG_SENS.rawView)" ${viewDisabled?"disabled":""}>${esc(_tvs(DG_SENS.rawView?"Düzenlemeye dön":"Ham analizi göster"))}</button></div></details>`;
menus+=`<details data-menu-owner="surface" data-menu-order="60" id="dgSensBoundaryDetails" class="dg-editor-menu" ontoggle="dgSensMenuToggle(this)"><summary><span>✏️ ${esc(_tvs("Sınır düzeltme"))}</span><span class="dg-paint-chevron" aria-hidden="true">⌄</span></summary><div class="dg-editor-menu-body"><p class="dg-sens-hint">${esc(_tvs("Sınıfı seç, haritada sınır köşelerine dokun, çizimi tamamla. Çizilen alan park sınırına kırpılır."))}</p><label class="dg-png-label" for="dgSensDrawType">${esc(_tvs("Sınır sınıfı"))}</label><select id="dgSensDrawType" onchange="dgSensSetDrawType(this.value)">${["building","pool","hard","water","green","bare"].map(k=>`<option value="${k}" ${DG_SENS.drawType===k?"selected":""}>${esc(_tvs(window.DG_SURFACE_REVIEW.types[k].label))}</option>`).join("")}</select>${DG_SENS.objectPick?`<p class="dg-sens-hint" role="status">${esc(_tvs("Haritada sınırını almak istediğiniz OSM nesnesine dokunun."))}</p>`:""}${DG_SENS.objectPreview?`<div class="dg-sens-object-preview"><p class="dg-sens-hint">${esc(_tvs("OSM nesne sınırı önizleniyor."))} · ${esc(DG_SENS.objectPreview.osmId)}<br>${esc(_tvs("OSM önerisi"))}: ${esc(_tvs(window.DG_SURFACE_REVIEW.types[DG_SENS.objectPreview.type].label))}<br>${esc(_tvs("Uygulanacak sınıf"))}: ${esc(_tvs(window.DG_SURFACE_REVIEW.types[DG_SENS.drawType].label))}<br>${esc(_tvs("Haritadaki ✓ düğmesi sınırı uygular, analizi günceller ve kaydeder."))}</p><div class="dg-sens-actions"><button type="button" class="dg-png-btn primary sm" onclick="dgSensObjectApplyAndAccept()" ${disabled?"disabled":""}>✓ ${esc(_tvs("Uygula, analiz et ve kaydet"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensObjectCancel();dgSensRenderPaintTools()">${esc(_tvs("Vazgeç"))}</button></div></div>`:""}<div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost sm" onclick="dgSensObjectPickStart()" ${disabled?"disabled":""}>📍 ${esc(_tvs(DG_SENS.objectPick?"Haritada nesneyi seç…":"Haritadan nesne seç"))}</button><button type="button" class="dg-png-btn blue sm" onclick="dgSensDrawStart()">✏ ${esc(_tvs("Sınır çiz"))}</button><button type="button" class="dg-png-btn primary sm" onclick="dgSensDrawFinish()">✓ ${esc(_tvs("Çizimi tamamla"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensDrawBack()">↩ ${esc(_tvs("Son köşeyi sil"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensDrawCancel()">${esc(_tvs("İptal"))}</button><button type="button" class="dg-png-btn ghost sm" onclick="dgSensUndoBoundary()" ${disabled||!(rec.features||[]).length?"disabled":""}>↶ ${esc(_tvs("Son sınırı geri al"))}</button></div><div id="dgSensFeatures">${(rec.features||[]).map((f,i)=>`<div class="dg-sens-feature"><span>${esc(_tvs(window.DG_SURFACE_REVIEW.types[f.type]?.label||f.type))}</span><button type="button" class="dg-png-btn ghost sm" onclick="dgSensRemoveFeature(${i})">↩ ${esc(_tvs("Geri al"))}</button></div>`).join("")}</div></div></details>`;
menus+=`<details data-menu-owner="surface" data-menu-order="70" id="dgSensDataDetails" class="dg-editor-menu" ontoggle="dgSensMenuToggle(this)"><summary><span>⚙️ ${esc(_tvs("Veri ve ayarlar"))}</span><span class="dg-paint-chevron" aria-hidden="true">⌄</span></summary><div class="dg-editor-menu-body"><label class="measure-share"><input class="dg-switch" type="checkbox" ${rec.useObjects!==false?"checked":""} onchange="dgSensObjects(this.checked)"> ${esc(_tvs("OSM bina, su ve sert zemin sınırlarını kullan"))}</label><p class="dg-sens-hint">${esc(_tvs("Yeni analizlerde OSM vektör kanıtı başlangıçta açıktır; nesne kapsamı eksik olabilir. İsteğe bağlıdır ve ham rasterı değiştirmez. Yalnız kabul edilen düzeltmeler kaydedilir."))}</p><label class="dg-png-label" for="dgSensPeriod">${esc(_tvs("Uydu tarama dönemi"))}</label><select id="dgSensPeriod" ${disabled||DG_SENS.rawView||DG_SENS.brush?"disabled":""} onchange="dgSensPeriod(this.value)"><option value="latest" ${rec.period==="latest"?"selected":""}>${esc(_tvs("Güncel görüntüler · son 120 gün"))}</option><option value="ytd" ${rec.period==="ytd"?"selected":""}>${esc(_tvs("Güncel yıl · 1 Ocak–bugün"))}</option><option value="ref" ${rec.period==="ref"?"selected":""}>2021</option></select><p class="dg-sens-hint">${esc(_tvs("Son 120 gün güncel kısa dönem taramasıdır. Güncel yıl seçeneği bu yılın 1 Ocak tarihinden bugüne kadar uygun Sentinel‑2 gözlemlerini kullanır. 2021 tarih uyumlu karşılaştırma içindir. Altlık haritasının tarihi ve ham 2021 raster sınıfları ayrıdır."))}</p></div></details>`;
 menus+=`<details data-menu-owner="surface" data-menu-order="50" id="dgSensBrushDetails" class="dg-editor-menu" ontoggle="dgSensMenuToggle(this)"><summary>${esc(_tvs("Yüzey fırçası"))}<span aria-hidden="true">⌄</span></summary><div class="dg-editor-menu-body"><label class="dg-png-label" for="dgSensBrushType">${esc(_tvs("Fırça sınıfı"))}</label><select id="dgSensBrushType" onchange="dgSensBrushChoose(this.value)" ${disabled?"disabled":""}>${types.map(k=>`<option value="${k}" ${type===k?"selected":""}>${esc(_tvs(window.DG_SURFACE_REVIEW.types[k].label))}</option>`).join("")}</select><label class="dg-png-label" for="dgSensBrushSize">${esc(_tvs("Fırça çapı"))}</label><select id="dgSensBrushSize" onchange="dgSensBrushConfig()" ${disabled?"disabled":""}>${[5,10,20,40].map(n=>`<option value="${n}" ${n===(DG_SENS.brush?.diameter||DG_SENS.brushDiameter)?"selected":""}>${n} m</option>`).join("")}</select><p class="dg-sens-hint">${esc(_tvs("Sol tuş: fırça · Sağ tuş: haritayı kaydır"))}</p></div></details>`;
 const mode=DG_SENS.draw?_tvst("Sınır çizimi · {class}",{class:_tvs(drawLabel)}):DG_SENS.brush?_tvst("Fırça · {class} · {size} m",{class:_tvs(label),size:DG_SENS.brush.diameter}):DG_SENS.objectPick?_tvs("Haritadan nesne seç") :DG_SENS.objectPreview?_tvst("Nesne önizlemesi · {class}",{class:_tvs(drawLabel)}):_tvs("Haritayı kaydır");
 host.innerHTML=`<section class="dg-editor" aria-label="${esc(_tvs("Harita düzenleyici"))}"><nav class="dg-editor-menubar" aria-label="${esc(_tvs("Harita menüsü"))}">${menus}</nav><div class="dg-editor-status" role="status" aria-live="polite"><span class="dg-editor-status-dot" aria-hidden="true"></span>${esc(mode)} · <span class="dg-editor-key-hint">ESC ${esc(_tvs("iptal"))}</span></div></section>`;
 const rail=document.getElementById("surfaceMapTools");if(rail)rail.innerHTML=`<div class="dg-editor-rail" role="group" aria-label="${esc(_tvs("Harita araçları"))}">
 <button type="button" class="dg-png-btn ghost sm dg-editor-tool ${!DG_SENS.brush&&!DG_SENS.draw?"is-active":""}" onclick="dgSensHandMode()" aria-pressed="${!DG_SENS.brush&&!DG_SENS.draw}" aria-label="${esc(_tvs("Haritayı kaydır"))}" title="${esc(_tvs("Haritayı kaydır"))}" ${disabled?"disabled":""}>✋</button>
 <button id="dgSensBrushBtn" type="button" class="dg-png-btn ghost sm dg-editor-tool ${DG_SENS.brush?"is-active":""}" onclick="dgSensBrushToggle()" aria-pressed="${!!DG_SENS.brush}" aria-label="${esc(_tvs(DG_SENS.brush?"Fırçayı kapat":"Fırçayı aç"))}" title="${esc(_tvs(DG_SENS.brush?"Fırçayı kapat":"Fırçayı aç"))}" ${disabled?"disabled":""}>🖌</button>
 <button type="button" class="dg-png-btn ghost sm dg-editor-tool" onclick="dgSensOpenMenu('dgSensBrushDetails')" aria-label="${esc(_tvs("Fırça sınıfı"))}" title="${esc(_tvs("Fırça sınıfı"))}">☷</button>
 <button type="button" class="dg-png-btn ghost sm dg-editor-tool ${DG_SENS.draw?"is-active":""}" onclick="dgSensDrawStart()" aria-pressed="${!!DG_SENS.draw}" aria-label="${esc(_tvs(DG_SENS.draw?"Çizim sürüyor":"Yeni sınır çiz"))}" title="${esc(_tvs(DG_SENS.draw?"Çizim sürüyor":"Yeni sınır çiz"))}" ${disabled?"disabled":""}>✏</button>
 <button type="button" class="dg-png-btn ${DG_SENS.objectPreview?"primary":"ghost"} sm dg-editor-tool" onclick="${DG_SENS.objectPreview?"dgSensObjectApplyAndAccept()":"dgSensDrawFinish()"}" aria-label="${esc(_tvs(DG_SENS.objectPreview?"Önizlemeyi uygula, analiz et ve kaydet":"Sınırı tamamla"))}" title="${esc(_tvs(DG_SENS.objectPreview?"Önizlemeyi uygula, analiz et ve kaydet":"Sınırı tamamla"))}" ${disabled||(!DG_SENS.objectPreview&&(!DG_SENS.draw||DG_SENS.draw.ring.length<3))?"disabled":""}>✓</button>
 <button type="button" class="dg-png-btn ghost sm dg-editor-tool ${DG_SENS.vegetationView?"is-active":""}" onclick="dgSensToggleVegetation(!DG_SENS.vegetationView)" aria-pressed="${DG_SENS.vegetationView}" aria-label="${esc(_tvs("Yeşil alanı göreli NDVI yoğunluğuna göre göster"))}" title="${esc(_tvs("Yeşil alan · göreli NDVI"))}" ${disabled||!vegReady?"disabled":""}>🌿</button>
 ${DG_SENS.draw?`<button type="button" class="dg-png-btn ghost sm dg-editor-tool" onclick="dgSensDrawCancel();DG_SENS.status=_tvs('Çizim iptal edildi.');dgSensRenderPaintTools();dgSensUpdateStatus()" aria-label="${esc(_tvs("Çizimi iptal et"))}" title="${esc(_tvs("Çizimi iptal et"))}">✕</button>`:""}
 <button type="button" class="dg-png-btn ghost sm dg-editor-tool" onclick="dgSensBrushUndo()" aria-label="${esc(_tvs("Son fırça izini geri al"))}" title="${esc(_tvs("Son fırça izini geri al"))}" ${disabled?"disabled":""}>↶</button></div>`;
 if(typeof dgEditorArrangeMenus==="function")dgEditorArrangeMenus();
}
function dgSensOpenMenu(id){dgSensCloseMenus();const menu=document.getElementById(id);if(menu){menu.open=true;menu.querySelector("summary")?.focus();}}
function dgSensMenuToggle(el){
 if(el.open)el.closest("#surfaceEditorMenu")?.querySelectorAll("details[open]").forEach(other=>{if(other!==el)other.open=false;});
}
function dgSensCloseMenus(){document.querySelectorAll("#surfaceEditorMenu details[open]").forEach(el=>{el.open=false;});}
if(typeof document.addEventListener==="function"){
 document.addEventListener("pointerdown",e=>{if(!e.target.closest?.("#surfaceEditorMenu, #surfaceMapTools"))dgSensCloseMenus();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(DG_SENS.draw){dgSensDrawCancel();DG_SENS.status=_tvs("Çizim iptal edildi.");dgSensRenderPaintTools();dgSensUpdateStatus();return;}const menu=document.querySelector("#surfaceEditorMenu details[open]");dgSensCloseMenus();menu?.querySelector("summary")?.focus();}});
}
function dgSensSetDrawType(type){
 if(!window.DG_SURFACE_REVIEW.types[type])return;
 DG_SENS.drawType=type;
 DG_SENS.objectPreviewLayer?.setStyle?.({color:DG_SENS_COLORS[type]||DG_SENS_COLORS.other});
 const select=document.getElementById("dgSensDrawType");if(select)select.value=type;
 document.querySelectorAll("#dgSensBoundaryDetails .dg-boundary-swatch").forEach(button=>{
  const active=button.dataset.surfaceType===type;button.classList.toggle("is-selected",active);button.setAttribute("aria-pressed",String(active));
 });
}
function dgSensBrushChoose(type){
 if(!window.DG_SURFACE_REVIEW.types[type]||DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving)return;
 DG_SENS.brushType=type;if(DG_SENS.brush){dgSensBrushStop();dgSensBrushToggle();}else dgSensRenderPaintTools();
}
function dgSensHandMode(){dgSensBrushStop();if(DG_SENS.draw)dgSensDrawCancel();dgSensRender();}
function dgSensBindRightPan(){
 if(typeof map==="undefined"||!map||typeof map.getContainer!=="function")return;
 const container=map.getContainer();if(!container?.addEventListener||DG_SENS.rightPan?.container===container)return;
 dgSensUnbindRightPan();
 const state=DG_SENS.rightPan={container,stroke:null,handlers:[]};
 const down=e=>{if(e.button!==2||!e.isPrimary)return;e.preventDefault();e.stopImmediatePropagation();state.stroke={id:e.pointerId,x:e.clientX,y:e.clientY};try{container.setPointerCapture(e.pointerId);}catch(err){};container.style.cursor="grabbing";};
 const move=e=>{const s=state.stroke;if(!s||s.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const dx=e.clientX-s.x,dy=e.clientY-s.y;s.x=e.clientX;s.y=e.clientY;if(dx||dy)map.panBy([-dx,-dy],{animate:false});};
 const finish=e=>{const s=state.stroke;if(!s||s.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();state.stroke=null;container.style.cursor=DG_SENS.brush?"crosshair":"";try{container.releasePointerCapture(e.pointerId);}catch(err){}};
 const menu=e=>{e.preventDefault();e.stopImmediatePropagation();};
 for(const [name,fn] of [["pointerdown",down],["pointermove",move],["pointerup",finish],["pointercancel",finish],["contextmenu",menu]]){container.addEventListener(name,fn,true);state.handlers.push([name,fn]);}
}
function dgSensUnbindRightPan(){const p=DG_SENS.rightPan;if(!p)return;for(const [name,fn] of p.handlers)p.container.removeEventListener(name,fn,true);p.container.style.cursor=DG_SENS.brush?"crosshair":"";DG_SENS.rightPan=null;}
function dgSensOpacity(value){DG_SENS.opacity=Math.max(0,Math.min(100,Number(value)||0));if(DG_SENS.record){DG_SENS.record.displayOpacity=DG_SENS.opacity;clearTimeout(DG_SENS.saveTimer);DG_SENS.saveTimer=setTimeout(()=>dgSensSave(),900);}const out=document.getElementById("dgSensOpacityValue");if(out)out.textContent="%"+DG_SENS.opacity;for(const p of DG_SENS.displayPaths||[])p.poly.setStyle({fillOpacity:DG_SENS.opacity/100});}
function dgSensUpdateSummary(){
 const a=dgSensAreas(),rec=DG_SENS.record;if(!a||!rec)return;
 for(const k of DG_SENS_CLASSES){const el=document.getElementById("dgSensCnt-"+k);if(el)el.textContent=rec.sens[k]+" · "+dgSensHa(a[k])+" ha";}
 dgSensRenderCurrentReport(a);
 const el=document.getElementById("dgSensSummary");if(el)el.textContent=_tvs(DG_SENS.editing?"Önizleme":"Kayıtlı sonuç")+" · "+Object.keys(a).filter(k=>a[k]>0).map(k=>_tvs(window.DG_SURFACE_REVIEW.types[k]?.label||k)+": "+dgSensHa(a[k])+" ha").join(" · ");
 const density=document.getElementById("dgSensVegetationSummary");if(density){const d=dgSensVegetationTiers(),cut=d.cutoffs?" · "+_tvs("terciller")+": "+d.cutoffs.map(v=>v.toFixed(2)).join(" / "):"";density.textContent=_tvs("Mevsimsel medyan NDVI · uygun hücre")+": "+d.count+" / "+d.eligible+cut+" · "+_tvs("Her hücrede en az 3 açık uydu gözlemi; park içi göreli sınıflar, taç örtüsü ölçümü değildir.");}
}
function dgSensUpdateStatus(){const el=document.getElementById("dgSensStatus");if(el)el.textContent=DG_SENS.status||(DG_SENS.mergeBusy?_tvs("Çizim güncelleniyor…"):_tvs(DG_SENS.record?.acceptedAt&&!DG_SENS.editing?"Kayıtlı sonuç korunuyor. Kaydırıcıyı değiştirerek yeni önizleme yapabilirsiniz.":"Önizleme henüz hesap kaydına yazılmadı."));}
async function dgSensScan(){
 if(DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving||!DG_SENS.record)return;dgSensBrushStop();
 const rec=DG_SENS.record,epoch=DG_SENS.epoch;dgSensResetScanState(rec);DG_SENS.visualVersion++;DG_SENS.focus=null;DG_SENS.busy=true;dgSensRender();
 try{
  const profile=await window.DG_LC_S2.profile(dgSensCells(),PARK_POLY,{year:DG_LC_LAST.report?.year||2021,mode:rec.period});
  if(epoch!==DG_SENS.epoch||DG_SENS.record!==rec)return;
  rec.profile=profile;DG_SENS.vegetationRenderKey=null;rec.spectralEnabled=false;rec.scannedAt=new Date().toISOString();dgSensDirty();DG_SENS.status=_tvs("Yeni tarama tamamlandı. Hassasiyet eşikleri nötr değerde; ham raster sınıfları korunuyor.");
  dgSensRefreshLayer();dgSensUpdateSummary();
  await dgSensSave();
 }catch(e){if(epoch===DG_SENS.epoch){DG_SENS.status=_tvs("Tarama başarısız: ")+String(e.message||e);toast(DG_SENS.status,"err");}}
 finally{if(epoch===DG_SENS.epoch){DG_SENS.busy=false;dgSensRender();dgSensRefreshLayer();}}
}
function dgSensPeriod(v){if(DG_SENS.rawView||DG_SENS.brush||DG_SENS.busy||DG_SENS.saving||!DG_SENS.record)return;DG_SENS.record.period=v==="ref"?"ref":v==="latest"?"latest":"ytd";dgSensScan();}
function dgSensSlide(cls,val){
 const rec=DG_SENS.record;if(!rec||DG_SENS.rawView||DG_SENS.brush||DG_SENS.busy||DG_SENS.saving||!DG_SENS_CLASSES.includes(cls))return;
 const n=Number(val);rec.sens[cls]=Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;
 rec.spectralEnabled=true;dgSensDirty();DG_SENS.focus=cls;DG_SENS.showCand=true;DG_SENS.status="";
 clearTimeout(DG_SENS.debounce);DG_SENS.debounce=setTimeout(()=>{DG_SENS.debounce=null;dgSensRefreshLayer();dgSensUpdateSummary();dgSensUpdateStatus();},250);
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
  const epoch=DG_SENS.epoch;DG_SENS.mergeBusy=true;dgSensUpdateStatus();
  try{const parts=dgSensParts();
   const job=await dgSensVisualResult(parts);
   if(epoch!==DG_SENS.epoch||key!==[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,DG_SENS.editing].join(":"))return;
   DG_SENS.mergedFeatures=job?.features||dgSurfaceMergeSync(parts,DG_SENS.epsg);DG_SENS.mergedKey=key;DG_SENS.layer.clearLayers();DG_SENS.displayPaths=[];
   DG_SENS.displayFeatures=job?.displayFeatures||dgSurfaceDisplaySync(parts,DG_SENS.epsg,DG_SENS.parkGeometry);
   const layerEpoch=DG_SENS.epoch,layerGeometry=DG_SENS.geometry;
   for(const f of DG_SENS.displayFeatures){const cls=f.properties.class;
    const rings=f.geometry.coordinates.map(poly=>poly.map(r=>r.map(p=>[p[1],p[0]])));
    const poly=L.polygon(rings,{renderer:DG_SENS.renderer,stroke:false,weight:0,smoothFactor:1,bubblingMouseEvents:false,fillColor:DG_SENS_COLORS[cls]||DG_SENS_COLORS.other});
    poly.on("click",ev=>{const oe=ev.originalEvent||ev;if(oe&&L.DomEvent?.stopPropagation)L.DomEvent.stopPropagation(oe);if(!dgSensLayerClickIsCurrent(layerEpoch,layerGeometry))return;if(DG_SENS.objectPick){dgSensObjectPickAt(ev);return;}if(DG_SENS.brush)return;if(DG_SENS.draw){dgSensDrawPoint(ev);return;}const q=dgLcUtmForward(ev.latlng.lat,ev.latlng.lng,DG_SENS.epsg);const part=dgSensParts().find(p=>{const b=p.displayBounds||(p.displayBounds=dgSurfaceBounds(p.geom));return q.x>=b[0]&&q.x<=b[2]&&q.y>=b[1]&&q.y<=b[3]&&dgGridPointDistance([q.x,q.y],p.geom)>=0;});if(part)dgSensPopup(part.key);});
    DG_SENS.displayPaths.push({poly,cls});
   }
  }catch(e){if(epoch===DG_SENS.epoch){DG_SENS.status=String(e.message||e);dgSensUpdateStatus();}}
  finally{DG_SENS.mergeBusy=false;dgSensUpdateStatus();if(epoch===DG_SENS.epoch&&key!==[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,DG_SENS.editing].join(":"))setTimeout(dgSensRefreshLayer,0);}
  if(key!==[DG_SENS.epoch,DG_SENS.partitionVersion,DG_SENS.visualVersion,DG_SENS.editing].join(":")){if(DG_SENS.record)setTimeout(dgSensRefreshLayer,0);return;}
 }
 if(!DG_SENS.showCand){DG_SENS.layer?.clearLayers();DG_SENS.vegetationLayer?.clearLayers();return;}
 for(const p of DG_SENS.displayPaths||[]){p.poly.setStyle({fillOpacity:DG_SENS.opacity/100});const visible=(!DG_SENS.focus||p.cls===DG_SENS.focus)&&!(DG_SENS.vegetationView&&p.cls==="green");if(visible){if(!DG_SENS.layer.hasLayer(p.poly))p.poly.addTo(DG_SENS.layer);}else DG_SENS.layer.removeLayer(p.poly);}
 if(DG_SENS.vegetationView)dgSensRenderVegetation();else DG_SENS.vegetationLayer?.clearLayers();
}
/* Display-only corner rounding, at most 1.5m. Areas and exports retain exact geometry. */
function dgSensSoftRing(ring,epsg){const pts=ring.slice(0,-1).map(p=>dgLcUtmForward(p[1],p[0],epsg)),out=[];for(let i=0;i<pts.length;i++){const p=pts[i],prev=pts[(i+pts.length-1)%pts.length],next=pts[(i+1)%pts.length];for(const q of [prev,next]){const d=Math.hypot(q.x-p.x,q.y-p.y),t=d?Math.min(.2,1.5/d):0,z=dgLcUtmInverse(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,epsg);out.push([z.lat,z.lon]);}}if(out.length)out.push(out[0]);return out;}

async function dgSensRepartition(featureOverride=null){
 const rec=DG_SENS.record;if(!rec)return false;const epoch=DG_SENS.epoch;let completed=false;
 DG_SENS.busy=true;dgSensRender();
 try{
  const features=featureOverride??(rec.features||[]);
  const data=await dgSurfacePrepare({cells:dgSensCells(),outer:PARK_POLY,holes:PARK_HOLES||[],epsg:DG_SENS.epsg,objects:rec.objectFeatures||null,elements:window.DG_SURFACE_OSM?.boundary===JSON.stringify(PARK_POLY)?window.DG_SURFACE_OSM.elements:[],features:DG_SENS.rawView?[]:features,useObjects:!DG_SENS.rawView&&rec.useObjects});
  if(epoch!==DG_SENS.epoch)return false;
  // Commit staged boundaries only after geometry preparation succeeds.
  if(featureOverride)rec.features=featureOverride;
  if(!rec.objectFeatures){rec.objectFeatures=data.objects;rec.objectVersion="footprints-v3-area-semantics";}
  DG_SENS.partitionVersion=(DG_SENS.partitionVersion||0)+1;DG_SENS.vegetationRenderKey=null;DG_SENS.vegetationLayer?.clearLayers();DG_SENS.parkGeometry=data.park;DG_SENS.geometry=data.geometries;
  if(dgSensMigrateBrushMasks(rec,dgSensCells(),data.geometries,data.park,DG_SENS.epsg)){rec.draftDirty=true;DG_SENS.editing=true;DG_SENS.visualVersion++;data.parts=window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,data.geometries,dgSensFeatures(),DG_SENS.epsg,data.park);}
  // Structured cloning preserves geometry references; rebind cells to the UI's canonical array.
  const cells=new Map(dgSensCells().map(c=>[dgSensCellKey(c),c]));for(const p of data.parts)p.cell=cells.get(p.key);
  dgSurfaceSeed(data.geometries,dgSensFeatures(),DG_SENS.epsg,data.park,data.parts,dgSensCells());
  DG_SENS.partsMemo=null;DG_SENS.visualMemo=null;completed=true;
  if(DG_SENS.layer)map.removeLayer(DG_SENS.layer);if(DG_SENS.renderer)map.removeLayer(DG_SENS.renderer);DG_SENS.layer=null;DG_SENS.renderer=null;
 }catch(e){if(epoch===DG_SENS.epoch){DG_SENS.status=_tvs("Sınır analizi tamamlanamadı: ")+String(e.message||e);toast(esc(DG_SENS.status),"err");}}
 finally{if(epoch===DG_SENS.epoch){DG_SENS.busy=false;dgSensRender();dgSensRefreshLayer();}}
 return completed;
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
 const c=dgSensCells()?.find(c=>dgSensCellKey(c)===key);if(DG_SENS.rawView||!c||!window.DG_SURFACE_REVIEW.types[toCls]||DG_SENS.busy||DG_SENS.saving)return;
 if(!dgSensSetCellDecision(c,toCls))return;dgSensDirty();map.closePopup();dgSensRefreshLayer();dgSensUpdateSummary();dgSensUpdateStatus();dgSensSave();
}
function dgSensUndo(key){if(DG_SENS.rawView||!DG_SENS.record||DG_SENS.busy||DG_SENS.saving)return;delete DG_SENS.record.corrections[key];dgSensDirty();map.closePopup();dgSensRefreshLayer();dgSensUpdateSummary();dgSensSave();}
function dgSensBulk(cls){for(const x of dgSensCandidates(cls))dgSensDecide(dgSensCellKey(x.cell),cls);}
async function dgSensAccept(){
 const rec=DG_SENS.record;if(!rec||DG_SENS.rawView||DG_SENS.brush||DG_SENS.saving||DG_SENS.busy||!DG_SENS.geometry||DG_SENS.draw)return;
 const epoch=DG_SENS.epoch,snapshot=JSON.parse(JSON.stringify(rec));
 // Keep immutable geometry identities so acceptance cannot invalidate the partition cache.
 snapshot.features=rec.features;snapshot.objectFeatures=rec.objectFeatures;
 for(const c of dgSensCells()){const key=dgSensCellKey(c);if(snapshot.corrections[key]?.method!=="visual-cell")snapshot.corrections[key]={from:c.classKey,to:dgSensEffective(c),method:"sensitivity",ts:new Date().toISOString()};}
 snapshot.editSummary=dgSensEditSummary(snapshot);snapshot.draftDirty=false;snapshot.acceptedAreas=dgSensAreas();snapshot.acceptedAt=new Date().toISOString();snapshot.modifiedAt=snapshot.acceptedAt;
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
function dgSensReset(){if(DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving||!confirm(_tvs("Tüm kullanıcı düzeltmeleri silinsin mi? Ham raster korunur.")))return;DG_SENS.record.corrections={};DG_SENS.record.features=[];DG_SENS.record.brushHistory=[];dgSensDirty();dgSensRepartition().then(ok=>ok&&dgSensSave());}
function dgSensFindObjectAt(latlng,elements=window.DG_SURFACE_OSM?.elements||[]){
 if(!latlng||!Array.isArray(elements)||!DG_SENS.geometry||!DG_SENS.parkGeometry||typeof dgSurfaceObjects!=="function")return null;
 const point=dgLcUtmForward(latlng.lat,latlng.lng,DG_SENS.epsg),candidates=dgSurfaceObjects(elements,DG_SENS.epsg);let best=null;
 for(const feature of candidates){
  const geom=feature.geometry?.type==="MultiPolygon"?feature.geometry.coordinates.map(poly=>poly.map(ring=>dgSurfaceProject(ring,DG_SENS.epsg))):[];
  for(const poly of geom){
   const bounds=dgSurfaceBounds([poly]);if(point.x<bounds[0]-8||point.x>bounds[2]+8||point.y<bounds[1]-8||point.y>bounds[3]+8)continue;
   const distance=dgGridPointDistance([point.x,point.y],[poly]);if(distance< -8)continue;
   const area=dgSurfaceArea([poly]),score=distance>=0?area/1e9:8+Math.abs(distance);
   if(!best||score<best.score)best={feature,geometry:[poly],score};
  }
 }
 if(!best)return null;
 const clipped=dgSurfaceClip("intersection",best.geometry,DG_SENS.parkGeometry);
 if(!clipped.length||dgSurfaceArea(clipped)<.1)return null;
 const geometry={type:"MultiPolygon",coordinates:dgSurfaceUnproject(clipped,DG_SENS.epsg)};
 if(!window.DG_SURFACE_REVIEW.validFeature({type:best.feature.type,geometry}))return null;
 return{type:best.feature.type,geometry,osmId:best.feature.osmId||"OSM"};
}
function dgSensObjectPickStart(){
 if(DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving||DG_SENS.exporting)return;
 const data=window.DG_SURFACE_OSM;if(!data||data.boundary!==JSON.stringify(PARK_POLY)){toast(_tvs("Bu park için güncel OSM sınırları bulunamadı. OSM verisini yükleyip yeniden deneyin."),"warn");return;}
 dgSensBrushStop();dgSensDrawCancel();dgSensObjectCancel();DG_SENS.objectPick=true;dgSensGuard(true);DG_SENS.status=_tvs("Sınırını seçeceğiniz OSM nesnesine dokunun.");
 map.on("click",dgSensObjectPickAt);dgSensRenderPaintTools();dgSensUpdateStatus();
}
function dgSensObjectPickAt(ev){
 if(!DG_SENS.objectPick||!ev?.latlng)return;
 let result=null;try{result=dgSensFindObjectAt(ev.latlng);}catch(e){toast(_tvs("OSM nesne sınırı geçersiz olduğu için seçilemedi. Sınırı elle çizebilirsiniz."),"warn");return;}if(!result){toast(_tvs("Bu noktada kapalı bir OSM nesne sınırı bulunamadı. Sınırı elle çizebilirsiniz."),"info");return;}
 map.off("click",dgSensObjectPickAt);DG_SENS.objectPick=false;DG_SENS.objectPreview=result;dgSensSetDrawType(result.type);
 DG_SENS.objectPreviewLayer=L.geoJSON({type:"Feature",properties:{},geometry:result.geometry},{style:{color:DG_SENS_COLORS[result.type]||"#2d8150",weight:3,dashArray:"7 5",fillOpacity:.16,interactive:false}}).addTo(map);
 dgSensRenderPaintTools();dgSensOpenMenu("dgSensBoundaryDetails");dgSensUpdateStatus();
}
function dgSensObjectCancel(){
 if(DG_SENS.objectPick&&typeof map!=="undefined"&&map)map.off("click",dgSensObjectPickAt);
 DG_SENS.objectPick=false;DG_SENS.objectPreview=null;
 if(DG_SENS.objectPreviewLayer&&typeof map!=="undefined"&&map)map.removeLayer(DG_SENS.objectPreviewLayer);
 DG_SENS.objectPreviewLayer=null;
}
function dgSensObjectApply(){
 const preview=DG_SENS.objectPreview,select=document.getElementById("dgSensDrawType"),type=window.DG_SURFACE_REVIEW.types[DG_SENS.drawType]?DG_SENS.drawType:select?.value||preview?.type;
 if(!preview||DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving||DG_SENS.exporting)return;
 if(!window.DG_SURFACE_REVIEW.types[type]){DG_SENS.status=_tvs("Önce uygulanacak sınıfı seçin.");dgSensUpdateStatus();toast(DG_SENS.status,"warn");return;}
 const rec=DG_SENS.record;if(!rec)return;
 const before=dgSensAreas()||{};
 const feature={type,geometry:preview.geometry,method:"visual-boundary",source:"osm-selected",osmId:preview.osmId,ts:new Date().toISOString()};
 if(!window.DG_SURFACE_REVIEW.validFeature(feature)){DG_SENS.status=_tvs("Seçilen nesnenin geometrisi uygulanamadı; sınırı yeniden seçin.");dgSensUpdateStatus();toast(DG_SENS.status,"warn");return;}
 DG_SENS.drawType=type;dgSensRenderPaintTools();
 return dgSensRepartition([...(rec.features||[]),feature]).then(async ok=>{
  if(!ok||DG_SENS.record!==rec)return false;
  dgSensObjectCancel();
  dgSensDirty();dgSensRenderPaintTools();
  const areas=dgSensAreas();if(!areas)return;
  const delta=Number(areas[type]||0)-Number(before[type]||0),label=_tvs(window.DG_SURFACE_REVIEW.types[type].label);
  DG_SENS.status=delta>.01?_tvst("{class} sınırı önizlemeye uygulandı (+{area} m²). Kalıcı sonuç için Kabul et ve kaydet.",{class:label,area:delta.toFixed(1)}):_tvst("{class} sınırı eklendi; 10 m raster hücrelerinde sınıf değişikliği oluşmadı. Geometriyi kontrol edin.",{class:label});
  const saved=await dgSensSave();if(!saved)return false;
  dgSensUpdateSummary();dgSensUpdateStatus();toast(DG_SENS.status,delta>.01?"ok":"warn");return true;
 });
}
async function dgSensObjectApplyAndAccept(){
 const applied=await dgSensObjectApply();
 if(!applied)return false;
 await dgSensAccept();
 return !DG_SENS.record?.draftDirty&&!!DG_SENS.record?.acceptedAt;
}
function dgSensDrawStart(){if(DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving)return;if(DG_SENS.draw){dgSensOpenMenu("dgSensBoundaryDetails");return;}dgSensObjectCancel();dgSensBrushStop();map.invalidateSize({pan:false});DG_SENS.drawType=document.getElementById("dgSensDrawType")?.value||DG_SENS.drawType||"building";DG_SENS.draw={type:DG_SENS.drawType,ring:[]};DG_SENS.status=_tvs("Haritada sınır köşelerine dokunun; tamamlamak için ✓ düğmesine basın.");dgSensUpdateStatus();dgSensGuard(true);map.on("click",dgSensDrawPoint);dgSensRenderPaintTools();dgSensOpenMenu("dgSensBoundaryDetails");}
function dgSensPointInPark(lat,lon){try{return typeof pointInPark==="function"?pointInPark(lat,lon,PARK_POLY):true;}catch(e){return true;}}
function dgSensDrawPoint(ev){if(!DG_SENS.draw||!ev.latlng)return;const {lat,lng}=ev.latlng;if(!dgSensPointInPark(lat,lng)){DG_SENS.status=_tvs("Köşe park sınırının dışında; çizim park içine kırpılır.");dgSensUpdateStatus();return;}const p=[lng,lat];if(DG_SENS.draw.ring.length>=300)return;DG_SENS.draw.ring.push(p);dgSensDrawRender();dgSensRenderPaintTools();}
function dgSensDrawRender(){if(DG_SENS.drawLayer)map.removeLayer(DG_SENS.drawLayer);DG_SENS.drawLayer=L.layerGroup().addTo(map);const pts=DG_SENS.draw.ring.map(p=>[p[1],p[0]]);if(pts.length>1)L.polyline(pts,{color:DG_SENS_COLORS[DG_SENS.draw.type],dashArray:"5 5",interactive:false}).addTo(DG_SENS.drawLayer);if(pts.length>2)L.polyline([pts.at(-1),pts[0]],{color:DG_SENS_COLORS[DG_SENS.draw.type],dashArray:"2 6",opacity:.7,interactive:false}).addTo(DG_SENS.drawLayer);for(const p of pts)L.circleMarker(p,{radius:5,color:DG_SENS_COLORS[DG_SENS.draw.type],fillColor:"#fff",fillOpacity:1,weight:2,interactive:false}).addTo(DG_SENS.drawLayer);}
function dgSensDrawBack(){if(DG_SENS.draw){DG_SENS.draw.ring.pop();dgSensDrawRender();dgSensRenderPaintTools();}}
function dgSensDrawCancel(){if(DG_SENS.drawLayer)map.removeLayer(DG_SENS.drawLayer);DG_SENS.drawLayer=null;DG_SENS.draw=null;map.off("click",dgSensDrawPoint);}
function dgSensDrawFinish(){
 const d=DG_SENS.draw;if(!d)return;
 if(!window.DG_SURFACE_REVIEW.validRing(d.ring)){toast(_tvs("En az üç köşe seçin; sınır kendi üzerine kesişmemeli."),"warn");return;}
 let geom;try{geom=dgSurfaceClip("intersection",[dgSurfaceProject(d.ring,DG_SENS.epsg)],DG_SENS.parkGeometry);}catch(e){toast(esc(String(e.message||e)),"warn");return;}
 if(dgSurfaceArea(geom)<.1){toast(_tvs("Çizim park sınırının dışında veya çok küçük."),"warn");return;}
 DG_SENS.record.features.push({...d,method:"visual-boundary",ts:new Date().toISOString()});dgSensDirty();dgSensDrawCancel();dgSensRenderPaintTools();dgSensRepartition().then(ok=>ok&&dgSensSave());
}
function dgSensRemoveFeature(i){if(DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving)return;DG_SENS.record.features.splice(i,1);dgSensDirty();dgSensRepartition().then(ok=>ok&&dgSensSave());}
function dgSensUndoBoundary(){if(DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving||!DG_SENS.record?.features?.length)return;dgSensRemoveFeature(DG_SENS.record.features.length-1);}
function dgSensExportGeoJson(){
 const rec=DG_SENS.record;if(!rec||!DG_SENS.geometry||DG_SENS.busy)return;
 const parts=window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,DG_SENS.geometry,dgSensFeatures(rec),DG_SENS.epsg,DG_SENS.parkGeometry);
 const vegetation=dgSensVegetationTiers(),profile=rec.profile?.cells||{};
 const features=parts.map(p=>{const key=dgSensCellKey(p.cell),e=profile[key];return{type:"Feature",properties:{row:p.cell.row,column:p.cell.col,original_class:p.cell.classKey,review_class:p.type,group:p.group,area_m2:p.areaM2,method:p.method,vegetation_ndvi_relative_class:p.type==="green"?(vegetation.tiers.get(key)||null):null,ndvi_median_season:e?.ndviMedianYear??null,ndvi_observation_days:e?.ndviObs??e?.yearObs??null,source_fingerprint:rec.fingerprint,accepted_at:rec.acceptedAt||null,view:DG_SENS.rawView?"raw":DG_SENS.editing?"preview":"accepted"},geometry:{type:"MultiPolygon",coordinates:dgSurfaceUnproject(p.geom,DG_SENS.epsg)}};});
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
function dgSensExportPng(){
 if(document.getElementById("dgSurfaceExportDialog"))return;
 const dialog=document.createElement("dialog");dialog.id="dgSurfaceExportDialog";dialog.className="dg-export-dialog card";
 const grid=typeof GRID_CELLS!=="undefined"&&GRID_CELLS.length>0;
 const points=[...(typeof LAST_WP_ROWS!=="undefined"?LAST_WP_ROWS:[]),...(typeof WP!=="undefined"?WP:[])];
 const pid=Number(document.getElementById("gridProject")?.value);
 const waypoints=[...new Map(points.filter(w=>Number.isFinite(Number(w.lat))&&Number.isFinite(Number(w.lon))&&(!w.project_id||Number(w.project_id)===pid)).map(w=>[String(w.project_id||pid)+":"+String(w.wp_id??w.id),w])).values()];
 dialog.innerHTML='<h3>'+esc(_tvs("Harita katmanları"))+'</h3><p class="dg-meta">'+esc(_tvs("İndirmek istediğiniz katmanları seçin."))+'</p>'+[['park','Park alanı',true],['surface','Park analizi',true],['grid','Gridler',grid],['waypoints','Waypointler',waypoints.length>0]].map(([id,label,available])=>'<label class="measure-share"><input class="dg-switch" type="checkbox" name="'+id+'" '+(available?'checked':'disabled')+'><span>'+esc(_tvs(label))+(available?'':'<small>'+esc(_tvs("Bu park için henüz oluşturulmadı."))+'</small>')+'</span></label>').join('')+'<p class="dg-meta" id="dgExportError" role="status"></p><div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost" id="dgExportCancel">'+esc(_tvs("Vazgeç"))+'</button><button type="button" class="dg-png-btn primary" id="dgExportDownload">'+esc(_tvs("PNG indir"))+'</button></div>';
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('#dgExportCancel').onclick=()=>dialog.close();
 dialog.querySelector('#dgExportDownload').onclick=()=>{const layers=Object.fromEntries(['park','surface','grid','waypoints'].map(k=>[k,dialog.querySelector('[name="'+k+'"]').checked]));if(!Object.values(layers).some(Boolean)){dialog.querySelector('#dgExportError').textContent=_tvs("En az bir katman seçin.");return;}dialog.close();dgSensRenderPng(layers,waypoints);};dialog.showModal();
}
async function dgSensRenderPng(layers={park:true,surface:true},waypoints=[]){
  const rec=DG_SENS.record,cells=dgSensCells();
  if(!rec||!cells||!cells.length||DG_SENS.busy||DG_SENS.saving||!DG_SENS.geometry){toast(_tvs("Önce arazi örtüsü analizini çalıştırın."),"warn","🖼️");return;}
  const edits=dgSensEditSummary(rec),nDec=edits.total;
  if(layers.surface&&!nDec&&!rec.acceptedAt&&!dgSensFeatures().length){toast(_tvs("Önce en az bir hücre kararı ver — doğrulanmış harita kararlarını gösterir."),"warn","🖼️");return;}
  const areas=dgSensAreas()||dgSensGroupAreas();
  const epsg=DG_SENS.epsg||dgLcUtmEpsgForLatLon(cells[0].center.lat,cells[0].center.lon);
  if(DG_SENS.exporting)return;
  const epoch=DG_SENS.epoch;DG_SENS.exporting=true;dgSensRender();
  try{
  const parts=dgSensParts();
  const displayJob=await dgSensVisualResult(parts);
  const displayFeatures=displayJob?.displayFeatures||dgSurfaceDisplaySync(parts,epsg,DG_SENS.parkGeometry);
  if(epoch!==DG_SENS.epoch)return;
  /* UTM zarfı */
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  let boundsReady=false;
  const PR=(lat,lon)=>{const z=dgLcUtmForward(lat,lon,epsg);if(!boundsReady){mnX=Math.min(mnX,z.x);mxX=Math.max(mxX,z.x);mnY=Math.min(mnY,z.y);mxY=Math.max(mxY,z.y);}return z;};
  for(const c of cells)for(const q of (c.quadWgs||[]))PR(q[1],q[0]);
  if(typeof PARK_POLY!=="undefined"&&PARK_POLY)for(const r of PARK_POLY)for(const q of r)PR(q[0],q[1]);
  boundsReady=true;
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
  for(const feature of layers.surface?displayFeatures:[]){
    g.beginPath();
    for(const poly of feature.geometry.coordinates)for(const ring of poly){ring.forEach((q,i)=>{const p=px(PR(q[1],q[0]));i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);});g.closePath();}
    g.fillStyle=COL[feature.properties.class]||COL.other;g.fill("evenodd");
  }
  if(layers.park&&typeof PARK_POLY!=="undefined"&&PARK_POLY&&PARK_POLY.length){
    g.beginPath();
    for(const r of [...PARK_POLY,...(typeof PARK_HOLES!=="undefined"?PARK_HOLES:[])]){let first=true;for(const q of r){const p=px(PR(q[0],q[1]));first?g.moveTo(p[0],p[1]):g.lineTo(p[0],p[1]);first=false;}g.closePath();}
    g.strokeStyle="#111827";g.lineWidth=2.5;g.stroke();
  }
  if(layers.grid&&typeof GRID_CELLS!=="undefined")for(const cell of GRID_CELLS){
    g.beginPath();for(const poly of cell.geometry?.coordinates||[])for(const ring of poly){ring.forEach((q,i)=>{const p=px(PR(q[1],q[0]));i?g.lineTo(...p):g.moveTo(...p);});g.closePath();}g.strokeStyle="#14532d";g.lineWidth=1;g.stroke();
  }
  if(layers.waypoints)for(const w of waypoints){const p=px(PR(Number(w.lat),Number(w.lon)));g.beginPath();g.arc(p[0],p[1],7,0,Math.PI*2);g.fillStyle=w.visited?"#22c55e":"#ef4444";g.fill();g.strokeStyle="#fff";g.lineWidth=2;g.stroke();g.fillStyle=INK;g.font="bold 14px Arial";g.fillText(String(w.wp_id??w.id??""),p[0]+10,p[1]+4);}
  /* sağ sütun */
  const X0=840;
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("PARK SAHASI",X0,300);
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText((typeof parkAreaHa==="function"?parkAreaHa().toFixed(1):"—")+" ha",X0,352);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("KULLANICI DÜZENLEMESİ",X0,420,CW-X0-40);
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText(String(edits.total),X0,472);
  g.fillStyle=MUT;g.font="18px Arial";g.fillText((edits.manualCells+edits.sensitivityCells)+" hücre · "+edits.boundaries+" sınır · "+edits.thresholds+" eşik · "+edits.appearance+" görünüm",X0,508,CW-X0-40);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("DOĞRULANMIŞ ALANLAR",X0,540);
  let y=580;
  for(const [k,label] of [["park","Park alanı"],["surface","Park analizi"],["grid","Gridler"],["waypoints","Waypointler"]])if(layers[k]){g.fillStyle=INK;g.font="20px Arial";g.fillText("✓ "+label,X0,y);y+=30;}
  y+=20;
  for(const k of layers.surface?["green","water","hard","bare","building","pool"]:[]){
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
  g.fillText("Kesin hücre geometrisi; kullanıcı düzeltmeleri ayrıca kaydedilir.",40,CH-54,CW-80);
  g.fillText("Raster: ESA WorldCover 2021 v200 (CC BY 4.0) · parmak izi "+String(rec.fingerprint||"").slice(0,8)+" · CC BY-NC 4.0",40,CH-26,CW-80);
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

function dgSensExportCsv(){const a=dgSensAreas();if(!a)return;const rec=DG_SENS.record;downloadBlob("dendrogeo_surface_"+rec.parkId+".csv","text/csv;charset=utf-8","\uFEFFclass,area_m2,area_ha,view,source_fingerprint\n"+Object.keys(a).map(k=>[k,a[k],a[k]/10000,DG_SENS.rawView?"raw":DG_SENS.editing?"preview":"accepted",rec.fingerprint].join(",")).join("\n"));}
function dgSensCleanup(){
 dgSensBrushStop();dgSensUnbindRightPan();dgSensObjectCancel();DG_SENS.editView=null;DG_SENS.rawView=false;++DG_SENS.epoch;dgSurfaceCancelJobs();clearTimeout(DG_SENS.debounce);clearTimeout(DG_SENS.saveTimer);DG_SENS.debounce=null;DG_SENS.resizeObserver?.disconnect();DG_SENS.resizeObserver=null;
 if(typeof map!=="undefined"&&map){if(DG_SENS.layer)map.removeLayer(DG_SENS.layer);if(DG_SENS.vegetationLayer)map.removeLayer(DG_SENS.vegetationLayer);if(DG_SENS.renderer)map.removeLayer(DG_SENS.renderer);DG_SENS.layer=null;DG_SENS.vegetationLayer=null;DG_SENS.renderer=null;DG_SENS.pathCache=null;dgSensDrawCancel();map.off("moveend",dgSensRefreshLayer);}
 const host=document.getElementById("lcSens");if(host){host.style.display="none";host.innerHTML="";if(DG_SENS.hostParent?.isConnected)DG_SENS.hostParent.insertBefore(host,DG_SENS.hostNext?.parentNode===DG_SENS.hostParent?DG_SENS.hostNext:null);else host.remove();}
 document.getElementById("map")?.classList.remove("surface-review-map");
 document.getElementById("v-map")?.classList.remove("surface-review-active");
 const pending=document.getElementById("surfacePendingTools");if(pending)pending.style.display="none";
 if(typeof dgEditorClearMenus==="function")dgEditorClearMenus("surface");
 for(const id of ["surfaceBrushTools","surfaceMapTools"]){const paint=document.getElementById(id);if(paint)paint.innerHTML="";}
 if(typeof map!=="undefined"&&map?.invalidateSize)map.invalidateSize({pan:false});
 Object.assign(DG_SENS,{record:null,layer:null,geometry:null,parkGeometry:null,busy:false,saving:false,exporting:false,baselineShown:false,baselineReport:null,mergedKey:null,mergedFeatures:null,displayPaths:null,hostParent:null,hostNext:null});
 DG_SENS.partsMemo=null;DG_SENS.visualMemo=null;
 dgSensGuard(false); /* 0056: park kapandı — algılama serbest */
}
window.DG_LC_SENS={mount:dgSensMount,cleanup:dgSensCleanup,guard:dgSensGuard,state:DG_SENS};

async function dgSensResultSnapshot(rec){
 const epsg=DG_SENS.epsg,cells=dgSensCells(),outer=PARK_POLY,holes=PARK_HOLES||[];
 const parts=dgSensParts();
 const totals={};for(const p of parts)totals[p.type]=(totals[p.type]||0)+p.areaM2;
 for(const [k,a] of Object.entries(rec.acceptedAreas))if(Math.abs(a-(totals[k]||0))>Math.max(.1,a*.00001))throw Error(_tvs("Analiz tüm parkı kapsamıyor. Parkı yeniden analiz edip tekrar kaydedin."));
 const job=await dgSensVisualResult(parts);
 const features=job?job.features:dgSurfaceMergeSync(parts,epsg);
 const displayFeatures=job?.displayFeatures||dgSurfaceDisplaySync(parts,epsg,DG_SENS.parkGeometry,features);
 return{schema:"dendrogeo-surface/2",parkId:rec.parkId,acceptedAt:rec.acceptedAt,fingerprint:rec.fingerprint,epsg,cellCount:cells.length,areas:rec.acceptedAreas,outer,holes,scenes:rec.profile?.scenes||[],features,displayFeatures,editSummary:dgSensEditSummary(rec),displayMethod:{name:"exact-geometry",version:4,tolerance_m:0},displayNote:"Harita, kesin kabul geometrisini gösterir; görsel yumuşatma uygulanmaz."};
}

function dgSensAreaBars(areas){
 const total=Object.values(areas).reduce((a,b)=>a+Number(b||0),0);
 return Object.entries(areas).filter(([k,v])=>v>0).map(([k,v])=>{const pct=total?100*v/total:0;return '<div class="dg-surface-stat"><span>'+esc(_tvs(window.DG_SURFACE_REVIEW.types[k]?.label||k))+'</span><b>'+dgSensHa(v)+' ha · %'+pct.toFixed(1)+'</b><div class="dg-surface-track" aria-hidden="true"><i style="width:'+pct+'%;background:'+DG_SENS_COLORS[k]+'"></i></div></div>';}).join('');
}
function dgSensRenderCurrentReport(areas){
 const host=document.getElementById("landCoverReport");if(!host)return;
 if(!DG_SENS.baselineReport)DG_SENS.baselineReport=host.innerHTML;
 host.innerHTML='<b>'+esc(_tvs(DG_SENS.rawView?"Ham 2021 raster sonucu":DG_SENS.editing?"Güncel yüzey önizlemesi":"Kayıtlı analiz sonucu"))+'</b>'+dgSensAreaBars(areas)+'<p class="dg-sens-hint">'+esc(_tvs(DG_SENS.editing?"Hassasiyet barları, fırça ve sınır düzeltmeleri bu özete yansır. Yayın için kabul edip kaydedin.":"Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez."))+'</p><details class="dg-sens-details"><summary>'+esc(_tvs("Ham 2021 raster sonucu"))+'</summary>'+DG_SENS.baselineReport+'</details>';
}
function dgSensRenderAccepted(){
 const r=DG_SENS.record?.acceptedResult,host=document.getElementById("landCoverReport");if(!r||!host)return;
 host.innerHTML='<b>'+esc(_tvs("Kayıtlı analiz sonucu"))+'</b><p class="dg-meta">'+esc(new Date(r.acceptedAt).toLocaleString())+'</p>'+dgSensAreaBars(r.areas)+'<p class="dg-sens-hint">'+esc(_tvs("Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez."))+'</p>';
}

function dgSensFeatures(rec=DG_SENS.record){if(DG_SENS.rawView)return [];return[...(rec?.useObjects!==false?rec?.objectFeatures||[]:[]),...(rec?.features||[])];}
function dgSensObjects(on){if(DG_SENS.rawView||!DG_SENS.record||DG_SENS.busy||DG_SENS.saving)return;DG_SENS.record.useObjects=on;dgSensDirty();dgSensRepartition().then(ok=>ok&&dgSensSave());}

async function dgSensRawView(on){
 if(!DG_SENS.record||DG_SENS.busy||DG_SENS.saving||DG_SENS.exporting||DG_SENS.rawView===!!on)return;
 const rec=DG_SENS.record,epoch=DG_SENS.epoch;
 // Raw viewing cannot edit the record, so its prepared editing geometry is reusable.
 if(on)DG_SENS.editView={record:rec,epoch,geometry:DG_SENS.geometry,parkGeometry:DG_SENS.parkGeometry,partitionVersion:DG_SENS.partitionVersion,visualMemo:DG_SENS.visualMemo};
 dgSensBrushStop();dgSensDrawCancel();dgSensObjectCancel();DG_SENS.rawView=!!on;
 DG_SENS.visualVersion++;DG_SENS.focus=null;DG_SENS.showCand=true;
 const prepared=DG_SENS.editView;
 if(!on&&prepared?.record===rec&&prepared.epoch===epoch&&prepared.geometry){
  DG_SENS.busy=true;
  try{
   if(DG_SENS.layer)map.removeLayer(DG_SENS.layer);if(DG_SENS.renderer)map.removeLayer(DG_SENS.renderer);
   DG_SENS.layer=null;DG_SENS.renderer=null;DG_SENS.mergedKey=null;DG_SENS.displayPaths=[];
   DG_SENS.geometry=prepared.geometry;DG_SENS.parkGeometry=prepared.parkGeometry;DG_SENS.partitionVersion=prepared.partitionVersion;DG_SENS.visualMemo=prepared.visualMemo;DG_SENS.partsMemo=null;
   dgSensRender();await dgSensRefreshLayer();
  }finally{if(epoch===DG_SENS.epoch&&DG_SENS.record===rec){DG_SENS.busy=false;DG_SENS.editView=null;dgSensRender();}}
 }else await dgSensRepartition();
 if(epoch===DG_SENS.epoch&&DG_SENS.record===rec)dgSensUpdateSummary();
}
function dgSensBrushStop(){
 const b=DG_SENS.brush;if(!b)return;DG_SENS.brush=null;
 for(const [event,fn] of b.handlers)b.container.removeEventListener(event,fn,true);
 try{if(b.stroke)b.container.releasePointerCapture(b.stroke.pointerId);}catch(e){}
 if(b.preview)map.removeLayer(b.preview);
 b.container.classList.remove('dg-paint-brush-active');b.container.style.touchAction=b.touchAction;b.container.style.cursor=b.cursor;
 if(b.dragging)map.dragging.enable();
 if(b.zoom)map.doubleClickZoom.enable();
}
function dgSensBrushCellKeys(points,diameter){
 const pc=window.polygonClipping;if(!pc||!DG_SENS.parkGeometry||!DG_SENS.geometry)return[];
 const masks=dgGridLineMask({pts:points,w:diameter/2},DG_SENS.epsg);if(!masks.length)return[];
 const brush=pc.intersection(pc.union(...masks),DG_SENS.parkGeometry);if(!brush.length)return[];
 const bounds=dgSurfaceBounds(brush),keys=[];
 for(const c of dgSensCells()||[]){const key=dgSensCellKey(c),cell=DG_SENS.geometry[key];if(!cell?.length)continue;const cb=dgSurfaceBounds(cell);if(!dgSurfaceOverlap(bounds,cb))continue;
  if(dgSurfaceArea(pc.intersection(cell,brush))>.01)keys.push(key);
 }
 return keys;
}
function dgSensSetCellDecision(cell,toCls,ts=new Date().toISOString(),strokeId=null){
 if(!cell||!window.DG_SURFACE_REVIEW.types[toCls])return null;
 const key=dgSensCellKey(cell),decision={from:cell.classKey,to:toCls,method:"visual-cell",ts};if(strokeId)decision.brushStrokeId=strokeId;
 DG_SENS.record.corrections[key]=decision;return{key,decision};
}
function dgSensPushBrushHistory(rec,stroke){if(!Array.isArray(rec.brushHistory))rec.brushHistory=[];rec.brushHistory.push(stroke);if(rec.brushHistory.length>20)rec.brushHistory.splice(0,rec.brushHistory.length-20);}
function dgSensMigrateBrushMasks(rec,cells,geometries,park,epsg){
 const old=Array.isArray(rec?.features)?rec.features:[];if(!old.some(f=>f.method==="visual-brush"))return false;
 const pc=window.polygonClipping,keep=[];rec.corrections=rec.corrections&&typeof rec.corrections==="object"?rec.corrections:{};let migrated=false;
 for(let i=0;i<old.length;i++){const f=old[i];if(f.method!=="visual-brush"){keep.push(f);continue;}
  let mask=[];try{mask=pc.intersection(dgSurfaceFeatureGeometry(f,epsg),park);}catch(e){}
  if(!mask.length){keep.push(f);continue;}
  const bounds=dgSurfaceBounds(mask),ts=f.ts||new Date().toISOString(),strokeId="legacy-"+ts+"-"+i,changes=[];
  for(const c of cells||[]){const key=dgSensCellKey(c),cell=geometries[key];if(!cell?.length||!dgSensOverlapBounds(bounds,cell))continue;
   if(dgSurfaceArea(pc.intersection(cell,mask))<=.01)continue;
   const previous=rec.corrections?.[key]?{...rec.corrections[key]}:null,decision={from:c.classKey,to:f.type,method:"visual-cell",ts,brushStrokeId:strokeId};rec.corrections[key]=decision;changes.push({key,before:previous,strokeId});
  }
  if(changes.length){dgSensPushBrushHistory(rec,{id:strokeId,changes,ts});migrated=true;}else keep.push(f);
 }
 if(migrated)rec.features=keep;return migrated;
}
function dgSensOverlapBounds(a,geometry){if(!geometry?.length)return false;const b=dgSurfaceBounds(geometry);return dgSurfaceOverlap(a,b);}
function dgSensBrushToggle(){
 if(DG_SENS.brush){dgSensBrushStop();dgSensRender();return;}
 if(!DG_SENS.record||DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving||DG_SENS.exporting)return;
 dgSensDrawCancel();map.closePopup();
 const container=map.getContainer(),type=document.getElementById('dgSensBrushType')?.value||DG_SENS.brushType;
 const diameter=Number(document.getElementById('dgSensBrushSize')?.value||DG_SENS.brushDiameter);
 if(!window.DG_SURFACE_REVIEW.types[type]||![5,10,20,40].includes(diameter))return;
 DG_SENS.brushType=type;DG_SENS.brushDiameter=diameter;container.classList.add('dg-paint-brush-active');
 const b=DG_SENS.brush={container,type,diameter,epoch:DG_SENS.epoch,record:DG_SENS.record,dragging:map.dragging.enabled(),zoom:map.doubleClickZoom.enabled(),touchAction:container.style.touchAction,cursor:container.style.cursor,handlers:[]};
 map.dragging.disable();map.doubleClickZoom.disable();container.style.touchAction='none';container.style.cursor='crosshair';
 const point=e=>{const p=map.mouseEventToLatLng(e);return[p.lat,p.lng];};
 const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
 const add=e=>{
  const p=point(e),last=b.stroke.points.at(-1),q=dgLcUtmForward(p[0],p[1],DG_SENS.epsg);
  if(last){const prev=dgLcUtmForward(last[0],last[1],DG_SENS.epsg);if(Math.hypot(q.x-prev.x,q.y-prev.y)<b.diameter/6)return;}
  if(b.stroke.points.length<300)b.stroke.points.push(p);
  if(b.preview)map.removeLayer(b.preview);b.preview=L.layerGroup().addTo(map);
  if(b.stroke.points.length>1)L.polyline(b.stroke.points,{color:DG_SENS_COLORS[b.type],weight:4,interactive:false}).addTo(b.preview);
  L.circle(p,{radius:b.diameter/2,color:DG_SENS_COLORS[b.type],fillOpacity:.2,interactive:false}).addTo(b.preview);
 };
 const down=e=>{if(e.target?.closest?.('.leaflet-control')||e.button!==0||!e.isPrimary||DG_SENS.busy||DG_SENS.saving||b.stroke)return;stop(e);b.stroke={pointerId:e.pointerId,points:[]};container.setPointerCapture(e.pointerId);add(e);};
 const move=e=>{if(b.stroke?.pointerId!==e.pointerId)return;stop(e);add(e);};
 const finish=e=>{if(b.stroke?.pointerId!==e.pointerId)return;stop(e);if(e.type==='pointerup')add(e);const points=b.stroke.points;b.stroke=null;if(b.preview)map.removeLayer(b.preview);b.preview=null;try{container.releasePointerCapture(e.pointerId);}catch(err){}
  if(e.type==='pointerup'&&b.epoch===DG_SENS.epoch&&b.record===DG_SENS.record)dgSensBrushCommit(points,b.type,b.diameter).catch(err=>{DG_SENS.status=String(err.message||err);dgSensUpdateStatus();});
 };
 for(const [event,fn] of [['pointerdown',down],['pointermove',move],['pointerup',finish],['pointercancel',finish],['lostpointercapture',finish]]){container.addEventListener(event,fn,true);b.handlers.push([event,fn]);}
 dgSensRender();
}
async function dgSensBrushCommit(points,type,diameter){
 if(!points.length||points.length>300||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180)||!window.DG_SURFACE_REVIEW.types[type]||![5,10,20,40].includes(diameter)||!DG_SENS.record||DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving)return;
 const rec=DG_SENS.record;
 const keys=dgSensBrushCellKeys(points,diameter);if(!keys.length)return;
 const ts=new Date().toISOString(),strokeId=Date.now().toString(36)+"-"+(++DG_SENS.strokeSeq).toString(36),changes=[],cellByKey=new Map((dgSensCells()||[]).map(c=>[dgSensCellKey(c),c]));
 for(const key of keys){const cell=cellByKey.get(key);if(!cell)continue;const before=rec.corrections?.[key]?{...rec.corrections[key]}:null,applied=dgSensSetCellDecision(cell,type,ts,strokeId);if(applied)changes.push({key,before,strokeId});}
 if(!changes.length)return;dgSensPushBrushHistory(rec,{id:strokeId,changes,ts,type,diameter_m:diameter});
 dgSensDirty();dgSensRefreshLayer();dgSensUpdateSummary();dgSensUpdateStatus();if(DG_SENS.record===rec)await dgSensSave();
}
function dgSensBrushUndo(){
 if(!DG_SENS.record||DG_SENS.rawView||DG_SENS.busy||DG_SENS.saving)return;
 const rec=DG_SENS.record,history=Array.isArray(rec.brushHistory)?rec.brushHistory:[],stroke=history.pop();rec.brushHistory=history;if(!stroke)return;let changed=false;
 for(const entry of [...stroke.changes].reverse()){const current=rec.corrections?.[entry.key];if(current?.brushStrokeId!==entry.strokeId)continue;if(entry.before)rec.corrections[entry.key]=entry.before;else delete rec.corrections[entry.key];changed=true;}
 if(changed){dgSensDirty();dgSensRefreshLayer();dgSensUpdateSummary();dgSensUpdateStatus();dgSensSave();}
}

function dgSensBrushConfig(){
 const type=document.getElementById('dgSensBrushType')?.value||DG_SENS.brushType,size=Number(document.getElementById('dgSensBrushSize')?.value||DG_SENS.brushDiameter);
 if(window.DG_SURFACE_REVIEW.types[type])DG_SENS.brushType=type;
 if([5,10,20,40].includes(size))DG_SENS.brushDiameter=size;
 dgSensBrushStop();dgSensRender();
}
