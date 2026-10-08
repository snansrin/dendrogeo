/* DendroGeo · One Park Analysis action.
 * The scientific 10m WorldCover grid is a REQUIRED input to the locked
 * Sentinel review. Keep this prerequisite but present it only as progress,
 * never as a second user-facing analysis or a duplicate map/report.
 * Does not write corrections, change class decisions, tweak thresholds or
 * mutate an accepted result. Published reports, verified map and PNG untouched.
 */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 const hookId="landCoverBtn";
 let active=false,iteration=0,observer=null,parkObserver=null,attached=null;
 const LABEL="🛰 Park Analizi";
 function syncButton(){
  const btn=$(hookId);
  if(btn&&!active&&!btn.disabled&&btn.textContent!==LABEL)btn.textContent=LABEL;
 }
 function progress(text,phase){
  const action=$("parkSurfaceAction");
  if(!action)return;
  let status=$("dgUnifiedParkAnalysisStatus");
  if(!status){
   status=document.createElement("p");
   status.id="dgUnifiedParkAnalysisStatus";
   status.className="dg-ux-park-analysis-progress";
   status.setAttribute("role","status");
   status.setAttribute("aria-live","polite");
   action.append(status);
  }
  if(status.textContent!==text)status.textContent=text;
  status.dataset.phase=phase||"info";
 }
 function reportVisibility(phase){
  const report=$("landCoverReport");
  if(report)report.dataset.dgUnifiedPhase=phase;
  const controls=$("lcSens");
  if(controls)controls.dataset.dgUnifiedPhase=phase;
 }
 function validSurface(){
  const s=window.DG_LC_SENS?.state;
  const lc=window.DG_LANDCOVER?.getLast?.();
  const cells=lc?.report?.cells||lc?.cells;
  return !!s?.record&&!!s.geometry&&!!s.parkGeometry&&
    !!lc&&(!Array.isArray(cells)||cells.length>0)&&!s.rawView;
 }

 // The grid knows OSM highway centerlines, but the locked scientific
 // dgSurfaceObjects parser needs surface tags or explicit widths. Reuse the
 // SAME verified same-park OSM ways as precise vector strips. Grid-only
 // lines never become 100 m² raster overrides: only their exact footprint
 // transfers to hard, preserving the leftover green area in each cell.
 const HARD_MATERIAL=new Set(["asphalt","paved","concrete","concrete:plates",
  "concrete:lanes","paving_stones","sett","cobblestone","bricks"]);
 const SOFT_MATERIAL=new Set(["dirt","earth","ground","grass","sand","mud",
  "woodchips","fine_gravel","gravel","unpaved","pebblestone","soil"]);
 const CONSTRUCTED_ROADS=new Set(["motorway","trunk","primary","secondary",
  "tertiary","unclassified","residential","living_street","service",
  "pedestrian","footway","cycleway","steps","path"]);
 const GENERATED_ROAD_SOURCE="osm-grid-road-exact-footprint";
 function roadEvidence(tags){
  const t=tags||{},hw=String(t.highway||"").toLowerCase();
  const surface=String(t.surface||"").toLowerCase();
  if(!CONSTRUCTED_ROADS.has(hw)||SOFT_MATERIAL.has(surface))return null;
  const material=HARD_MATERIAL.has(surface),bridge=t.bridge==="yes"||
   /^(pier|bridge)$/.test(t.man_made||"");
  // Explicit hard material is direct evidence. A mapped constructed road
  // without a material tag is a narrow *OSM-based proposal*, not an observed
  // pavement measurement. Its source is recorded for field review.
  const accepted=material||bridge||CONSTRUCTED_ROADS.has(hw);
  if(!accepted)return null;
  let halfWidth;
  const width=Number.parseFloat(String(t.width||"").replace(",","."));
  if(Number.isFinite(width)&&width>0&&width<=30)halfWidth=width/2;
  else if(hw==="steps")halfWidth=1;
  else if(["footway","path","cycleway"].includes(hw))halfWidth=1.1;
  else if(hw==="pedestrian")halfWidth=1.6;
  else if(hw==="service")halfWidth=2.25;
  else halfWidth=2.75;
  return{halfWidth,material:material?"explicit-paved":"mapped-road-geometry",
   bridge,highway:hw,surface:surface||null};
 }
 function candidateRoads(elements){
  const list=[],seen=new Set();
  for(const el of elements||[]){
   if(el?.type!=="way"||!Array.isArray(el.geometry)||el.geometry.length<2)continue;
   const tag=roadEvidence(el.tags);if(!tag)continue;
   const id="way/"+el.id;if(seen.has(id))continue;seen.add(id);
   const points=el.geometry.filter(p=>Number.isFinite(p?.lon)&&Number.isFinite(p?.lat))
    .map(p=>[p.lon,p.lat]);
   if(points.length<2||points.length>450)continue;
   list.push({id,points,...tag});
  }
  return list;
 }
 function roadFootprint(road,epsg){
  if(typeof dgSurfaceProject!=="function"||typeof dgSurfaceClip!=="function")return[];
  const xy=dgSurfaceProject(road.points,epsg),pieces=[];
  const h=road.halfWidth;
  for(let i=1;i<xy.length;i++){
   const a=xy[i-1],b=xy[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
   if(len<.05)continue;
   const ox=-dy/len*h,oy=dx/len*h;
   pieces.push([[[a[0]+ox,a[1]+oy],[b[0]+ox,b[1]+oy],
     [b[0]-ox,b[1]-oy],[a[0]-ox,a[1]-oy],[a[0]+ox,a[1]+oy]]]);
  }
  if(!pieces.length)return[];
  return dgSurfaceClip("union",...pieces);
 }
 function hardRoadDrafts(osm,existing,epsg,parkGeom){
  const roads=candidateRoads(osm);
  if(!roads.length||!Array.isArray(parkGeom)||!parkGeom.length)return[];
  const blockers=(existing||[]).filter(f=>["water","pool","building"].includes(f.type));
  // Clip constructed paths to the actual park and exclude scientific water
  // and building polygons. A grid blocker is NEVER enough to turn a lake,
  // a building or an unpaved tagged path into paved area.
  const masks=blockers.map(f=>{
   try{return{type:f.type,geometry:dgSurfaceFeatureGeometry(f,epsg)};}
   catch(_){return{type:f.type,geometry:[]};}
  }).filter(item=>item.geometry?.length);
  const out=[];
  for(const road of roads.slice(0,250)){
   try{
    let geometry=dgSurfaceClip("intersection",roadFootprint(road,epsg),parkGeom);
    if(!geometry?.length)continue;
    if(!road.bridge){
     for(const item of masks){
      geometry=dgSurfaceClip("difference",geometry,item.geometry);
      if(!geometry.length)break;
     }
    }else{
     // A true bridge can cross water, never a mapped building.
     for(const item of masks)if(item.type==="building"&&item.geometry.length){
      geometry=dgSurfaceClip("difference",geometry,item.geometry);
      if(!geometry.length)break;
     }
    }
    if(!geometry?.length||dgSurfaceArea(geometry)<.15)continue;
    out.push({type:"hard",method:"osm-boundary",osmId:road.id,
     source:GENERATED_ROAD_SOURCE,roadEvidence:road.material,
     roadHighway:road.highway,roadSurface:road.surface,priority:3,
     geometry:{type:"MultiPolygon",coordinates:dgSurfaceUnproject(geometry,epsg)}});
   }catch(error){
    // Invalid OSM line fails closed; the rest of the park remains usable.
    console.warn("DendroGeo: yol geometrisi doğrulanamadı",road.id,String(error?.message||error).slice(0,100));
   }
  }
  return out;
 }
 async function applyGridRoads(){
  const s=window.DG_LC_SENS?.state,rec=s?.record,osm=window.DG_SURFACE_OSM;
  if(!rec||s.rawView||rec.useObjects===false||!s.geometry||!s.parkGeometry||
    !Array.isArray(osm?.elements)||typeof PARK_POLY==="undefined"||
    osm.boundary!==JSON.stringify(PARK_POLY))return{count:0,reason:"no-matched-osm"};
  if(s.busy||s.saving||s.draw||s.brush)return{count:0,reason:"busy"};
  const original=rec.objectFeatures||[];
  const preexisting=original.filter(f=>f?.source!==GENERATED_ROAD_SOURCE);
  const roads=hardRoadDrafts(osm.elements,preexisting,s.epsg,s.parkGeometry);
  if(!roads.length)return{count:0,reason:"no-qualified-road"};
  const extras=roads.filter(f=>!preexisting.some(o=>o.osmId===f.osmId&&o.type==="hard"));
  if(!extras.length)return{count:0,reason:"already-classified"};
  const first=preexisting.filter(f=>!["water","pool","building"].includes(f.type));
  const water=preexisting.filter(f=>["water","pool"].includes(f.type));
  const buildings=preexisting.filter(f=>f.type==="building");
  const assembled=[...first,...water,...extras,...buildings];
  const epoch=s.epoch,park=rec.parkId,prior=rec.objectFeatures;
  rec.objectFeatures=assembled;
  // Invalidate only the new draft; accepted result/DOI remains intact.
  if(typeof dgSensDirty==="function")dgSensDirty();
  const ok=typeof dgSensRepartition==="function"?await dgSensRepartition():false;
  if(!ok||s.epoch!==epoch||s.record!==rec||rec.parkId!==park){
   if(s.record===rec)rec.objectFeatures=prior;
   return{count:0,reason:"geometry-failed"};
  }
  if(typeof dgSensSave==="function")await dgSensSave();
  return{count:extras.length,source:GENERATED_ROAD_SOURCE,
   provisional:extras.filter(x=>x.roadEvidence==="mapped-road-geometry").length,
   materialConfirmed:extras.filter(x=>x.roadEvidence==="explicit-paved").length};
 }
 async function run(){
  if(active||window._dgLandCoverBusy)return false;
  if(typeof window.runLandCoverAnalysis!=="function"){
   progress("Park analizi modülü yüklenemedi. Yeniden deneyin.","error");return false;
  }
  const token=++iteration;
  active=true;reportVisibility("pending");
  const btn=$(hookId);
  if(btn){btn.disabled=true;btn.textContent="⏳ Park analiz ediliyor…";}
  progress("1/3 · Park sınırı ve 10 m raster hazırlanıyor…","working");
  let ok=false;
  try{
   // The locked baseline builds DG_LC_LAST.report.cells. It also mounts
   // the approved review engine; its interim report stays visually hidden.
   await window.runLandCoverAnalysis();
   if(token!==iteration)return false;
   if(!validSurface())throw Error("10 m raster veya park tarama altyapısı hazır değil. İlk analiz sonucu gösterilmedi.");
   progress("2/3 · Sentinel-2 taraması ve mevcut su/yol/bina sınırları inceleniyor…","working");
   if(typeof dgSensScan!=="function")throw Error("Yüzey tarayıcısı hazır değil.");
   const scanned=await dgSensScan();
   if(token!==iteration)return false;
   if(scanned!==true)throw Error(window.DG_LC_SENS?.state?.status||"Uydu taraması tamamlanamadı.");
   // Same OSM ways used by grid exclusion, now exact sub-cell hard road
   // footprints in the review draft. Do not let the scan's water updater
   // change priority after these are installed.
   const roads=await applyGridRoads();
   if(token!==iteration)return false;
   if(roads.count){
    progress("OSM grid yol çizgilerinden "+roads.count+
      " dar yol izi sert zemine aktarıldı; "+roads.provisional+
      " iz malzeme etiketi içermediğinden saha kontrolü gerektiriyor.","working");
   }
   // A secondary evidence-only recheck (different acquisition period) may
   // resolve old raster-water shoreline pixels, never guesses/manual labels.
   const water=window.DG_GIS_WATER_NEIGHBOUR;
   const pending=water?.missingParts?.()?.length||0;
   let outcome=null;
   if(pending&&typeof water?.recheckMissing==="function"){
    progress("3/3 · Su çekilme alanlarındaki "+pending+" hücre ek uydu kanıtıyla kontrol ediliyor…","working");
    outcome=await water.recheckMissing();
   }
   if(token!==iteration)return false;
   const unresolved=Number.isFinite(outcome?.remaining)?outcome.remaining:
    (water?.missingParts?.()?.length||0);
   reportVisibility("ready");
   const reviewed=Number(outcome?.resolved||0);
   const roadNote=roads.count?" · OSM yol izi: "+roads.count+" (malzeme doğrulaması bekleyen: "+roads.provisional+")":"";
   progress(unresolved>0?
    "Tarama tamamlandı. Ek uydu kanıtıyla "+reviewed+" hücre çözüldü; "+
     unresolved+" hücre bilimsel doğrulama bekliyor"+roadNote+
     ". Bu alanlar incelenmeden sonuç kabul edilemez.":
    "Park analizi tamamlandı. Güncel yüzey sonuçları tek kartta gösteriliyor"+roadNote+".",
    unresolved>0||roads.provisional>0?"warning":"success");
   ok=true;
   return true;
  }catch(error){
   // Never show the preliminary WorldCover area report as if it were a
   // successfully reviewed result. Prevent a false 'all clear' state.
   reportVisibility("failed");
   progress("Park analizi tamamlanamadı: "+String(error?.message||error),"error");
   return false;
  }finally{
   active=false;
   const live=$(hookId);
   if(live){live.disabled=false;live.textContent=LABEL;}
   if(!ok&&token===iteration)reportVisibility("failed");
  }
 }
 function onClick(event){
  const btn=event.target?.closest?.("#"+hookId);
  if(!btn||btn.disabled||active)return;
  if(typeof window.runLandCoverAnalysis!=="function")return;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  void run();
 }
 function attach(){
  const host=$("parkInfo");
  if(host&&host!==attached){
   attached=host;
   observer?.disconnect?.();
   if(typeof MutationObserver==="function"){
    observer=new MutationObserver(syncButton);
    observer.observe(host,{childList:true,subtree:true});
   }
  }
  syncButton();
 }
 function init(){
  document.addEventListener?.("click",onClick,true);
  attach();
  const park=$("v-map");
  if(park&&typeof MutationObserver==="function"){
   parkObserver=new MutationObserver(attach);
   parkObserver.observe(park,{childList:true,subtree:false});
  }
 }
 window.DG_GIS_PARK_ANALYSIS={run,syncButton,candidateRoads,roadEvidence,hardRoadDrafts,applyGridRoads};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();