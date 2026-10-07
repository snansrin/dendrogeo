Warning: truncated output (original token count: 20504)
Total output lines: 723

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
 if(!profile)return{tiers:new Map(),count:0,eligible:0};
 const candidates=[];
 for(const cell of cells){
  if(dgSensEffective(cell)!=="green")continue;
  const e=profile[dgSensCellKey(cell)],value=e?.ndviMedianYear==null?NaN:Number(e.ndviMedianYear),obs=Number(e?.ndviObs??e?.yearObs??e?.obs??0);
  if(Number.isFinite(value)&&obs>=3)candidates.push({key:dgSensCellKey(cell),value});
 }
 candidates.sort((a,b)=>a.value-b.value||a.key.localeCompare(b.key));
 const tiers=new Map(),n=candidates.length;
 if(n>=9)for(let i=0;i<n;i++)tiers.set(candidates[i].key,i<Math.ceil(n/3)?"sparse":i>=Math.floor(2*n/3)?"dense":"moderate");
 return{tiers,count:n,eligible:cells.filter(c=>dgSensEffective(c)==="green").length};
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
 // Manual cells and a…15504 tokens truncated…"))+'</b><p class="dg-meta">'+esc(new Date(r.acceptedAt).toLocaleString())+'</p>'+dgSensAreaBars(r.areas)+'<p class="dg-sens-hint">'+esc(_tvs("Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez."))+'</p>';
}

function dgSensFeatures(rec=DG_SENS.record){if(DG_SENS.rawView)return [];return[...(rec?.useObjects!==false?rec?.objectFeatures||[]:[]),...(rec?.features||[])];}
function dgSensObjects(on){if(DG_SENS.rawView||!DG_SENS.record||DG_SENS.busy||DG_SENS.saving)return;DG_SENS.record.useObjects=on;dgSensDirty();dgSensRepartition().then(dgSensSave);}

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
