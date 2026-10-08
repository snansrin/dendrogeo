/* DendroGeo GIS workspace v2 · UI-only. No surface classification, raster,
 * sensitivity, saved result or map layer state may be modified here.
 * The original DOM nodes and onclick handlers are always retained. */
(function(){
 "use strict";
 let pending=0, observer=null, mapTool="",mapInstance=null,drawLayer=null,drawPoints=[],clickHandler=null,captureTarget=null,captureClick=null;
 // Park controls are moved into transient details nodes by the legacy menus.
 // Their owner may remove/rebuild a details node while preserving its old
 // child references only here. Restore those EXISTING inputs, never clone them.
 const parked={grid:null,layer:null,export:null,summary:null};
 const BUILDING_PRESENTATION_COLOR="#334155";
 let pendingBoundaryRestart=0;
 const $=id=>document.getElementById(id);
 const view=()=> $("v-map");
 const editorActive=()=>!!view()?.classList.contains("surface-review-active");
 function txt(node,s){if(node&&node.textContent!==s)node.textContent=s;}
 function el(tag,cls,content){
  const n=document.createElement(tag);if(cls)n.className=cls;
  if(content!=null)n.textContent=content;return n;
 }
 function enqueue(){
  if(pending)return;
  pending=setTimeout(()=>{pending=0;sync();},75);
 }
 function menuPosition(menu){
  if(!menu?.open)return;
  const panel=menu.querySelector(":scope > .dg-editor-menu-body");
  if(!panel)return;
  const viewport=window.visualViewport;
  const width=viewport?.width||window.innerWidth;
  const height=viewport?.height||window.innerHeight;
  const offsetTop=viewport?.offsetTop||0,offsetLeft=viewport?.offsetLeft||0;
  if(width<=700){
   const menuRect=menu.getBoundingClientRect();
   const top=Math.max(offsetTop+8,Math.min(menuRect.bottom+6,height+offsetTop-155));
   panel.style.position="fixed";
   panel.style.left=(offsetLeft+10)+"px";
   panel.style.right="auto";
   panel.style.top=top+"px";
   panel.style.width="calc(100vw - 20px)";
   panel.style.maxHeight=Math.max(120,height+offsetTop-top-12)+"px";
   return;
  }
  const rect=menu.getBoundingClientRect(),ideal=Math.min(440,width-24);
  const left=Math.max(offsetLeft+12,Math.min(rect.left,width+offsetLeft-ideal-12));
  // Tablet/desktop: an anchored dropdown near the lower edge must open
  // inside the visible viewport, not extend below it.
  const panelHeight=Math.min(Math.max(140,panel.scrollHeight||0),Math.max(140,height-20));
  if(rect.bottom+panelHeight+8>height+offsetTop){
   panel.style.position="fixed";
   panel.style.left=left+"px";panel.style.right="auto";
   panel.style.top=Math.max(offsetTop+8,height+offsetTop-panelHeight-10)+"px";
   panel.style.width="min(440px,calc(100vw - 24px))";
   panel.style.maxHeight=Math.max(120,height-20)+"px";
   return;
  }
  panel.style.position="absolute";
  panel.style.left=(left-rect.left)+"px";
  panel.style.right="auto";
  panel.style.top="calc(100% + 6px)";
  panel.style.width="min(440px,calc(100vw - 24px))";
  panel.style.maxHeight="";
 }
 function openMenu(menu){
  $("surfaceMenuBar")?.querySelectorAll(":scope > details[open]").forEach(other=>{
   if(other!==menu)other.open=false;
  });
  menuPosition(menu);
 }
 function makeOutput(){
  const menu=el("details","dg-editor-menu dg-ux-output-menu");
  menu.dataset.menuOwner="workspace";
  menu.dataset.menuOrder="45";
  const summary=el("summary");
  summary.innerHTML=window.DG_EDITOR_UI?.menuLabel?.("file","Dosya")||"Dosya";
  const panel=el("div","dg-editor-menu-body");
  panel.innerHTML=window.DG_EDITOR_UI?.panelHead?.("file","Harita çıktısı","Altlığı ve PNG içeriğini seç, ardından indir.")||"<strong>Harita çıktısı</strong>";
  const note=el("p","dg-ux-option-note","İndirme ayarları analizin hesaplarını veya kayıtlı sonuçları değiştirmez.");
  panel.append(note);
  menu.append(summary,panel);
  menu.addEventListener("toggle",()=>{if(menu.open)openMenu(menu);});
  return menu;
 }

 // Keep BOTH export actions independently available even when the park panel
 // gets rebuilt and the old parkRasterExport DOM node is temporarily detached.
 function ensureQuickPngAction(bar){
  const coreFile=bar?.querySelector?.('details[data-menu-owner="surface"][data-menu-order="10"]');
  if(!coreFile)return;
  const verified=coreFile.querySelector('button[onclick*="dgSensExportPng"]');
  const actions=verified?.parentElement;
  if(!actions||typeof document.createElement!=="function")return;
  let quick=coreFile.querySelector("#dgUxQuickPngDownload");
  if(!quick){
   quick=el("button","dg-png-btn ghost sm","🖼️ PNG İndir");
   quick.id="dgUxQuickPngDownload";quick.type="button";
   quick.addEventListener("click",()=>window.DG_GIS_PNG_EXPORT?.download?.());
   verified.after(quick);
  }
  let choice=coreFile.querySelector("#dgUxQuickPngBase");
  if(!choice){
   choice=el("select","dg-ux-quick-png-base");
   choice.id="dgUxQuickPngBase";
   choice.setAttribute("aria-label","PNG altlığı");
   for(const [value,label] of [["vector","Vektör"],["osm","OSM"],["sat","Uydu"],["topo","Topoğrafik"]]){
    const opt=document.createElement("option");opt.value=value;opt.textContent=label;choice.append(opt);
   }
   choice.value=$("pngBg")?.value||"vector";
   choice.addEventListener("change",()=>{
    const existing=$("pngBg");if(existing)existing.value=choice.value;
   });
   quick.before(choice);
  }
  quick.hidden=false;choice.hidden=false;
 }
 function syncPark(){
  const bar=$("surfaceMenuBar");
  if(!bar)return;
  for(const [key,id] of [["grid","parkGridTools"],["layer","parkLayerTools"],["export","parkRasterExport"],["summary","gridSummary"]]){
   const live=$(id);if(live)parked[key]=live;
  }
  // When the original park menu was reconstructed, its old moved controls
  // could have been detached by innerHTML/replaceChildren. Recover the exact
  // same form nodes before asking the original menu renderer to mount them.
  if(!bar.querySelector('details[data-menu-owner="park"]')){
   const home=$("surfaceParkTools");
   if(home){
    for(const key of ["grid","layer"]){
     if(!$(parked[key]?.id)&&parked[key])home.append(parked[key]);
    }
    if(!$("gridSummary")&&parked.summary)home.append(parked.summary);
   }
   if($("parkGridTools")&&$("parkLayerTools")&&typeof dgParkMountMenus==="function")dgParkMountMenus();
  }
  if(window.DG_LC_SENS?.state?.record&&!bar.querySelector('details[data-menu-owner="surface"]')&&typeof dgSensRenderPaintTools==="function")
   dgSensRenderPaintTools();
  ensureQuickPngAction(bar);
  const exportCard=$("parkRasterExport")||parked.export;
  const layer=$("parkLayerTools")||parked.layer;
  if(!exportCard||!layer)return;
  const coreFile=bar.querySelector('details[data-menu-owner="surface"][data-menu-order="10"]');
  let menu=coreFile||bar.querySelector(".dg-ux-output-menu");
  if(coreFile){
   bar.querySelector(".dg-ux-output-menu")?.remove(); // no duplicate Rapor & Çıktı tab
  }else{
   if(!menu)menu=makeOutput();
   const next=[...bar.children].find(n=>n!==menu&&Number(n.dataset.menuOrder)>45)||null;
   if(menu.parentElement!==bar||menu.nextElementSibling!==next)bar.insertBefore(menu,next);
  }
  const panel=menu.querySelector(":scope > .dg-editor-menu-body");
  if(!panel)return;
  if(exportCard.parentElement!==panel)panel.append(exportCard);
  const verified=coreFile?.querySelector('button[onclick*="dgSensExportPng"]');
  if(verified&&verified.textContent!=="🖼️ Doğrulanmış Harita")verified.textContent="🖼️ Doğrulanmış Harita";
  const legacy=exportCard.querySelector('button[onclick*="downloadParkImage"]');
  if(legacy)legacy.hidden=false; // Restore the separate quick PNG action; verified map keeps its original layer-selection dialog.

  const select=$("pngBg");
  const label=select?.closest(".dg-png-field")?.querySelector("label");
  if(label&&!label.htmlFor)label.htmlFor="pngBg";
  const pngFields=$("chkPngGrid")?.closest(".dg-png-field");
  if(pngFields){
   let section=layer.querySelector(".dg-ux-export-section");
   if(!section){
    section=el("section","dg-ux-export-section");
    section.append(el("h4","","PNG görünüm katmanları"),
      el("p","dg-ux-option-note","Yalnızca indirilen PNG'de gösterilir. Canlı haritayı değiştirmez."));
    const reset=layer.querySelector(".dg-png-btn.red");
    if(reset)reset.before(section);else layer.append(section);
   }
   if(pngFields.parentElement!==section)section.append(pngFields);
   const label=pngFields.querySelector(":scope > label.dg-png-label");
   if(label)label.hidden=true; // section heading supplies the descriptive label
  }
  for(const id of ["gridProject","gridSize","refHa","gridClearance"]){
   const input=$(id),label=input?.parentElement?.querySelector(".dg-png-label");
   if(label&&!label.htmlFor)label.htmlFor=id;
  }
  if(menu.open)menuPosition(menu);
 }
 function syncGroupLayout(){
  const host=$("liveAnalysis");if(!host)return;
  const groups=[...host.querySelectorAll(".card .lbl")].filter(n=>n.textContent.trim()==="Grup Dağılımı");
  for(const label of groups){
   const stats=label.nextElementSibling;
   if(stats?.tagName==="DIV")stats.classList.add("dg-ux-group-summary");
  }
 }
 function syncSpecies(){
  const host=$("liveAnalysis");
  if(!host)return;
  const headings=[...host.querySelectorAll(".card .lbl")].filter(n=>n.textContent.trim()==="En Yaygın 6 Tür");
  for(const label of headings){
   let head=label.closest(".dg-ux-species-head");
   if(!head){
    head=el("div","dg-ux-species-head");label.before(head);head.append(label);
   }
   // The species analysis is already visible here and in the report.
   // Remove the extra one-off PNG button, not the record/chart itself.
   head.querySelectorAll(".dg-png-btn").forEach(b=>b.remove());
   // Older renders placed the same redundant button beside the heading.
   const adjacent=head.nextElementSibling;
   if(adjacent?.matches?.("button.dg-png-btn")&&/png indir/i.test(adjacent.textContent||""))adjacent.remove();
   if(!head.querySelector(".dg-ux-species-caption"))head.append(el("span","dg-ux-species-caption","6 tür · onaylı kayıt sıralaması"));
   let collapse=head.closest("details.dg-ux-species-collapse");
   if(!collapse){
    collapse=el("details","dg-ux-species-collapse");
    collapse.open=false;
    head.before(collapse);
    const summary=el("summary","dg-ux-species-toggle");
    summary.append(head);
    const list=el("div","dg-ux-species-list");
    collapse.append(summary,list);
    // Move six ORIGINAL species rows, not clones, so the scientific counts
    // and their percentage bars remain exactly as generated by dash.js.
    let node=collapse.nextElementSibling;
    for(let i=0;i<6&&node;i++){
     const next=node.nextElementSibling;
     if(node.firstElementChild?.querySelector("span")){
      node.classList.add("dg-ux-species-row");
      list.append(node);
     }
     node=next;
    }
   }
  }
 }
 const radians=n=>n*Math.PI/180;
 function pathLength(points){
  let len=0;
  for(let i=1;i<points.length;i++)len+=L.latLng(points[i-1]).distanceTo(L.latLng(points[i]));
  return len;
 }
 function areaMeters(points){
  if(points.length<3)return 0;
  // Spherical polygon surface area, in meters squared; provisional map measure,
  // NOT an input into ESA/UTM carbon or surface classification.
  let sum=0;
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length];
   let delta=radians(b.lng-a.lng);
   if(delta>Math.PI)delta-=2*Math.PI;
   if(delta< -Math.PI)delta+=2*Math.PI;
   sum+=delta*(2+Math.sin(radians(a.lat))+Math.sin(radians(b.lat)));
  }
  return Math.abs(sum)*6371008.8**2/2;
 }
 const unit=(m,area=false)=>area?(m>=10000?(m/10000).toFixed(3)+" ha":m.toFixed(1)+" m²"):(m>=1000?(m/1000).toFixed(2)+" km":m.toFixed(1)+" m");
 function coords(latlng){
  return latlng.lat.toFixed(6)+", "+latlng.lng.toFixed(6);
 }
 function setStatus(message){txt($("dgUxMapStatus"),message);}
 function closeTool(){
  if(mapInstance&&clickHandler)mapInstance.off("click",clickHandler);
  if(captureTarget&&captureClick)captureTarget.removeEventListener("click",captureClick,true);
  if(mapInstance&&drawLayer)mapInstance.removeLayer(drawLayer);
  mapInstance=null;drawLayer=null;clickHandler=null;captureTarget=null;captureClick=null;drawPoints=[];mapTool="";
  const box=$("dgUxMapTools");
  box?.querySelectorAll("button[data-tool]").forEach(b=>{b.setAttribute("aria-pressed","false");b.classList.remove("is-active");});
 }
 function getMap(){return typeof map!=="undefined"&&map?.on&&window.L?map:null;}
 function redraw(){
  if(!drawLayer||!mapInstance)return;
  drawLayer.clearLayers();
  if(!drawPoints.length)return;
  const style={color:getComputedStyle(document.body).getPropertyValue("--green").trim()||"#16803d",weight:3};
  drawPoints.forEach(p=>L.circleMarker(p,{radius:5,color:style.color,weight:2,fillOpacity:.9}).addTo(drawLayer));
  if(drawPoints.length>1)L.polyline(drawPoints,style).addTo(drawLayer);
  // A permanent, non-interactive label marks EACH segment's own distance.
  // Clearing the transient layer also clears all labels when measuring ends.
  if(mapTool==="distance"&&typeof L.tooltip==="function"){
   for(let i=1;i<drawPoints.length;i++){
    const from=drawPoints[i-1],to=drawPoints[i];
    const middle=L.latLng({lat:(from.lat+to.lat)/2,lng:(from.lng+to.lng)/2});
    const meters=L.latLng(from).distanceTo(L.latLng(to));
    L.tooltip({permanent:true,direction:"center",interactive:false,opacity:1,className:"dg-ux-distance-label"})
     .setLatLng(middle).setContent(unit(meters)).addTo(drawLayer);
   }
  }
  if(mapTool==="area"&&drawPoints.length>2)L.polygon(drawPoints,{...style,fillOpacity:.1}).addTo(drawLayer);
  const length=pathLength(drawPoints);
  setStatus(drawPoints.length+" köşe · "+(mapTool==="area"?(drawPoints.length>=3?unit(areaMeters(drawPoints),true):"Alan için en az 3 köşe seç"):"Mesafe: "+unit(length)));
 }
 function activateTool(mode){
  const m=getMap();
  if(!m){setStatus("Harita hazır değil. Canlı Harita'yı açıp yeniden deneyin.");return;}
  // Measurement is a transient read-only map operation. The surface editor
  // may remain open, but its cell-popup and park-pick handlers must not fire.
  if(mapTool===mode){closeTool();setStatus("Ölçüm kapatıldı.");return;}
  closeTool();mapInstance=m;mapTool=mode;drawLayer=L.layerGroup().addTo(m);
  clickHandler=e=>{if(e?.latlng){drawPoints.push(e.latlng);redraw();}};
  // Leaflet surface polygons handle a path's click and stop propagation.
  // Capture map clicks BEFORE Leaflet's SVG/canvas delegation (and PARK_MODE).
  // No interception occurs outside an explicitly active measure tool.
  captureTarget=m.getContainer?.();
  if(captureTarget?.addEventListener&&typeof m.mouseEventToLatLng==="function"){
   captureClick=e=>{
    if(!mapTool||!mapInstance||e.button===2||e.target?.closest?.(".leaflet-control,.leaflet-popup,.leaflet-tooltip,.dg-editor-rail"))return;
    if(mapInstance.dragging?.moved?.())return;
    const point=m.mouseEventToLatLng(e);
    if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return;
    e.stopImmediatePropagation?.();
    e.stopPropagation?.();
    clickHandler({latlng:point});
   };
   captureTarget.addEventListener("click",captureClick,true);
  }else{
   m.on("click",clickHandler);
  }
  const selected=$("dgUxMapTools")?.querySelector('button[data-tool="'+mode+'"]');
  if(selected){selected.setAttribute("aria-pressed","true");selected.classList.add("is-active");}
  setStatus(mode==="area"?"Haritada alan köşelerine dokun. Bitirmek için Ölçümü bitir.":"Haritada mesafe noktalarına dokun. Bitirmek için Ölçümü bitir.");
 }
 function focusPark(){
  const m=getMap();
  if(!m){setStatus("Harita henüz yüklenmedi.");return;}
  const polygon=typeof PARK_POLY!=="undefined"?PARK_POLY:null;
  if(!Array.isArray(polygon)||polygon.length<3){setStatus("Önce park seçin.");return;}
  const coords=polygon.map(p=>Array.isArray(p)?p:[]).filter(p=>p.length>=2);
  if(!coords.length)return;
  m.fitBounds(L.latLngBounds(coords),{padding:[18,18],maxZoom:18});
  setStatus("Seçili park haritada ortalandı.");
 }
 function coordinateQuery(){
  const m=getMap(),raw=$("dgUxCoordInput")?.value.trim()||"";
  const match=raw.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
  if(!m||!match){setStatus("Koordinatları enlem, boylam biçiminde girin.");return;}
  const lat=Number(match[1].replace(",",".")),lon=Number(match[2].replace(",","."));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){setStatus("Geçerli WGS84 enlem/boylam girin.");return;}
  m.setView([lat,lon],Math.max(m.getZoom(),16));
  setStatus("Konum: "+coords({lat,lng:lon}));
 }
 async function copyCoordinate(){
  const value=$("dgUxCoordInput")?.value.trim()||"";
  if(!value){setStatus("Önce bir koordinat girin.");return;}
  try{
   if(!navigator.clipboard?.writeText)throw Error("clipboard");
   await navigator.clipboard.writeText(value);setStatus("Koordinat panoya kopyalandı.");
  }catch(e){$("dgUxCoordInput")?.select();setStatus("Koordinat seçildi; kopyalamak için Kopyala komutunu kullanın.");}
 }
 function newControl(label,onClick,kind){
  const b=el("button","dg-png-btn ghost sm",label);b.type="button";
  if(kind)b.dataset.tool=kind;
  b.addEventListener("click",onClick);return b;
 }
 function syncMapTools(){
  const bar=$("surfaceMenuBar"),viewMenu=bar?.querySelector('details[data-menu-order="20"]');
  const body=viewMenu?.querySelector(".dg-editor-menu-body");
  if(!body||body.querySelector("#dgUxMapTools"))return;
  const section=el("section","dg-editor-menu-section dg-ux-map-section");
  section.id="dgUxMapTools";
  section.append(el("span","dg-editor-menu-section-label","HARİTA ÖLÇÜM VE İNCELEME"));
  const nav=el("div","dg-ux-tool-grid");
  nav.append(
   newControl("📐 Mesafe ölç",()=>activateTool("distance"),"distance"),
   newControl("⬡ Alan ölç",()=>activateTool("area"),"area"),
   newControl("✓ Ölçümü bitir",()=>{closeTool();setStatus("Geçici ölçüm kaldırıldı.");}),
   newControl("⌖ Parka odaklan",focusPark)
  );
  section.append(nav);
  const current=nav.querySelector('button[data-tool="'+mapTool+'"]');
  if(current){current.setAttribute("aria-pressed","true");current.classList.add("is-active");}
  const coordLabel=el("label","dg-png-label","WGS84 · ENLEM, BOYLAM");
  coordLabel.htmlFor="dgUxCoordInput";
  const row=el("div","dg-ux-coordinate-row"),input=el("input","dg-png-input");
  input.id="dgUxCoordInput";input.type="text";input.placeholder="39.992000, 32.650000";
  input.inputMode="decimal";input.autocomplete="off";
  input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();coordinateQuery();}});
  row.append(input,newControl("Git",coordinateQuery),newControl("Kopyala",copyCoordinate));
  section.append(coordLabel,row);
  const note=el("p","dg-ux-option-note","Ölçümler geçici harita araçlarıdır; analiz hücrelerini veya kayıtları değiştirmez.");
  note.id="dgUxMapStatus";note.setAttribute("role","status");note.setAttribute("aria-live","polite");
  section.append(note);body.append(section);
 }
 // Visual parity only: reconstruct the preview rows in the exact three-part
 // layout of the WorldCover result (label, 16px class bar, area + percent).
 // Numerical values and the accepted/raw records are never recalculated here.
 function styleSurfacePreview(host){
  if(typeof document.createElement!=="function"||typeof host.querySelectorAll!=="function")return;
  const rows=[...host.querySelectorAll(":scope > .dg-surface-stat")];
  if(!rows.length||!rows[0]?.before)return;
  const panel=document.createElement("div");panel.className="dg-ux-surface-rows";
  rows[0].before(panel);
  const types=window.DG_SURFACE_REVIEW?.types||{};
  const icons={green:"🌿",water:"💧",hard:"🧱",building:"🏢",pool:"💦",bare:"🟫",other:"⬜"};
  const defaults={"Yeşil alan":"green","Su":"water","Sert zemin":"hard","Bina":"building","Havuz":"pool","Çıplak zemin":"bare","Diğer":"other"};
  for(const row of rows){
   const label=row.querySelector?.(":scope > span");
   // Historical scientific 'other' remains in data/QA, but its nearest
   // land-cover colour is applied in the map; no extra class is added to UI.
   if(label?.textContent?.trim()==="Diğer"){row.remove();continue;}
   const value=row.querySelector?.(":scope > b");
   const fill=row.querySelector?.(":scope > .dg-surface-track > i");
   if(label&&value&&fill){
    const name=label.textContent.trim();
    const type=Object.entries(types).find(([,meta])=>meta?.label===name)?.[0]||defaults[name];
    if(type&&icons[type])label.prepend(document.createTextNode(icons[type]+" "));
    const mapColor=type==="building"?BUILDING_PRESENTATION_COLOR:fill.style?.backgroundColor;
    if(type==="building")fill.style.backgroundColor=BUILDING_PRESENTATION_COLOR;
    if(mapColor){
     row.style.setProperty("--dg-ux-surface-color",mapColor);
     const slider=typeof document.getElementById==="function"&&type?document.getElementById("dgSensRange-"+type):null;
     if(slider)slider.style.setProperty("--dg-ux-slider-color",mapColor);
    }
    const original=value.textContent.trim();
    const match=original.match(/^(.*?)\s*·\s*(%[0-9.,]+)$/);
    if(match){
     value.textContent=match[1]+" · ";
     const pct=document.createElement("span");pct.className="dg-ux-surface-percentage";
     pct.textContent=match[2];value.append(pct);
    }
   }
   panel.append(row);
  }
 }
 // The locked core generates both source and edited summaries in one DOM.
 // Present exactly one at a time; its calculations, records and raw source stay intact.
 function syncSurfaceReport(){
  const state=window.DG_LC_SENS?.state;
  const host=$("landCoverReport");
  if(!host||!state?.record)return;
  if(state.rawView){
   const original=state.baselineReport;
   if(typeof original==="string"&&original&&host.innerHTML!==original)
    host.innerHTML=original;
  }else{
   // Historical raw report remains in state.baselineReport and in 'Ham analizi göster'.
   host.querySelectorAll(":scope > details.dg-sens-details").forEach(n=>n.remove());
   styleSurfacePreview(host);
  }
  const evidence=typeof document.querySelector==="function"?document.querySelector("#dgSensEvidenceDetails"):null;
  if(evidence&&!evidence.dataset.dgUxInitialized){
   evidence.dataset.dgUxInitialized="1";
   evidence.open=false; // QA remains available on demand; never lost.
  }
 }
 function syncNdviMapInfo(){
  const rail=$("surfaceMapTools"),state=window.DG_LC_SENS?.state;
  if(!rail||typeof document.createElement!=="function")return;
  let badge=$("dgUxNdviMapInfo");
  if(!editorActive()||!state?.vegetationView){
   badge?.remove();return;
  }
  if(!badge){
   badge=el("div","dg-ux-ndvi-map-info");badge.id="dgUxNdviMapInfo";
   badge.setAttribute("role","status");
   rail.append(badge);
  }
  const tiers=typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers():null;
  const values=tiers?.tiers?[...tiers.tiers.values()]:[];
  const counts={sparse:values.filter(x=>x==="sparse").length,moderate:values.filter(x=>x==="moderate").length,dense:values.filter(x=>x==="dense").length};
  const cut=tiers?.cutoffs?.length===2?tiers.cutoffs.map(x=>Number(x).toFixed(2)).join(" / "):"—";
  const description=tiers?.count>=9?
   "Göreli NDVI açık · "+tiers.count+"/"+tiers.eligible+" uygun hücre · Seyrek "+counts.sparse+" / Orta "+counts.moderate+" / Yoğun "+counts.dense+" · eşikler "+cut:
   "Göreli NDVI: uygun veri bekleniyor (hücre başına ≥3 gözlem, en az 9 hücre).";
  txt(badge,description);
  // Keep already-computed display polygons above the base/land-cover canvas,
  // otherwise valid NDVI is described in the report but hidden on the map.
  if(tiers?.count>=9&&state.vegetationLayer?.eachLayer)
   state.vegetationLayer.eachLayer(layer=>layer.bringToFront?.());
 }
 function syncBrushChoices(){
  // Pool/fountain shares the Su brush workflow; keep the historical class,
  // recorded pool polygons and boundary editor untouched.
  const select=typeof document.querySelector==="function"?document.querySelector("#dgSensBrushType"):null,state=window.DG_LC_SENS?.state;
  if(!select)return;
  if(state?.brushType==="pool"&&!state.busy&&!state.saving&&!state.rawView&&typeof dgSensBrushChoose==="function"){
   dgSensBrushChoose("water"); // also replaces an already-active pool brush safely
   return;
  }
  const legacyPool=select.querySelector('option[value="pool"]');
  if(legacyPool)legacyPool.remove();
  if(select.value==="pool")select.value="water";
 }
 // Presentation-only unification. The locked engine retains legacy pool
 // geometry and its separate area key for audit; users see one Su class.
 function waterPresentationAreas(areas){
  if(!areas||typeof areas!=="object")return null;
  const water=Number(areas.water||0),pool=Number(areas.pool||0);
  const total=Object.values(areas).reduce((n,value)=>n+(Number(value)||0),0);
  return {water:water+pool,pool,total,pct:total>0?(water+pool)*100/total:0};
 }
 function syncWaterSurfaceRows(){
  const host=$("landCoverReport"),state=window.DG_LC_SENS?.state;
  if(!host||!state?.record||state.rawView)return;
  const entries=[...host.querySelectorAll(".dg-ux-surface-rows > .dg-surface-stat")];
  const label=row=>row?.querySelector?.(":scope > span")?.textContent||"";
  const pool=entries.find(row=>/Havuz|süs havuzu/i.test(label(row)));
  if(!pool)return; // already reconciled (avoid mutation-observer loops)
  let water=entries.find(row=>/Su|💧/.test(label(row)));
  if(!water){water=pool;const name=water.querySelector(":scope > span");if(name)name.textContent="💧 Su";}
  const areas=state.editing?state.partsMemo?.areas:(state.record.acceptedResult?.areas||state.partsMemo?.areas);
  const merged=waterPresentationAreas(areas);
  if(merged&&merged.total>0){
   const value=water.querySelector(":scope > b");
   if(value){
    value.textContent=(merged.water/10000).toFixed(3)+" ha · ";
    const percent=document.createElement("span");
    percent.className="dg-ux-surface-percentage";percent.textContent="%"+merged.pct.toFixed(1);
    value.append(percent);
   }
  }else if(pool!==water){
   // Only displayed rounded numbers are available (never edit source data).
   const parse=row=>{const t=row.querySelector?.(":scope > b")?.textContent||"";
    return Number((t.match(/([0-9]+(?:[.,][0-9]+)?)\s*ha/)||[])[1]?.replace(",","."))||0;};
   const waterHa=parse(water)+parse(pool);
   const value=water.querySelector(":scope > b");
   if(value)value.textContent=waterHa.toFixed(3)+" ha";
  }
  if(pool!==water)pool.remove();
  if(water){
   const labelNode=water.querySelector(":scope > span");
   if(labelNode&&labelNode.textContent!=="💧 Su")labelNode.textContent="💧 Su";
   const fill=water.querySelector(":scope > .dg-surface-track > i");
   if(fill)fill.style.backgroundColor="#3b82f6";
   water.style?.setProperty?.("--dg-ux-surface-color","#3b82f6");
  }
 }
 function syncWaterStatusSummary(){
  const state=window.DG_LC_SENS?.state,rec=state?.record;
  if(!rec||state.rawView)return;
  const areas=state.editing?state.partsMemo?.areas:(rec.acceptedResult?.areas||state.partsMemo?.areas);
  const combined=waterPresentationAreas(areas);
  if(!combined||!combined.total)return;
  const label=key=>key==="water"?"Su":(window.DG_SURFACE_REVIEW?.types?.[key]?.label||key);
  const keys=Object.keys(areas).filter(k=>k!=="pool");
  if(Number(areas.pool||0)>0&&!keys.includes("water"))keys.push("water");
  const ha=value=>(Number(value||0)/10000).toFixed(3);
  const summary=(state.editing?"Önizleme":"Kayıtlı sonuç")+" · "+
   keys.filter(k=>Number(k==="water"?combined.water:areas[k])>0)
    .filter(k=>k!=="other")
    .map(k=>label(k)+": "+ha(k==="water"?combined.water:areas[k])+" ha").join(" · ");
  const node=typeof document.querySelector==="function"?document.querySelector("#dgSensSummary"):null;
  if(node&&node.textContent!==summary)node.textContent=summary;
  const counter=typeof document.querySelector==="function"?document.querySelector("#dgSensCnt-water"):null;
  const display=String(rec.sens?.water??50)+" · "+ha(combined.water)+" ha";
  if(counter&&counter.textContent!==display)counter.textContent=display;
 }
 function normalizeWaterText(root){
  if(!root||typeof document.createTreeWalker!=="function")return;
  const walk=document.createTreeWalker(root,4); // text nodes only, keep inputs/buttons
  let node;
  while((node=walk.nextNode())){
   const old=node.nodeValue||"";
   const current=old.replace(/Bina, su ve havuz sınırları ayrı vektör kanıtı olarak gösterilir/g,
     "Bina ve su sınırları vektör kanıtı olarak gösterilir")
    .replace(/Küçük bina ve havuzlar için/g,"Küçük binalar ve su yapıları için")
    .replace(/\bsu\/havuz\b/gi,"su")
    .replace(/Havuz\s*\/\s*süs havuzu|Havuz\s*\/\s*Süs Havuzu/gi,"Su")
    .replace(/\bhavuzlar\b/gi,"su yapıları")
    .replace(/\bhavuz\b/gi,"su");
   if(old!==current)node.nodeValue=current;
  }
 }
 function syncWaterBoundary(){
  const state=window.DG_LC_SENS?.state;
  const select=typeof document.querySelector==="function"?document.querySelector("#dgSensDrawType"):null;
  const pool=select?.querySelector?.('option[value="pool"]');
  if(pool)pool.remove();
  if(select&&state?.drawType==="pool"&&!state.busy&&!state.saving&&!state.draw&&typeof dgSensSetDrawType==="function"){
   dgSensSetDrawType("water");
  }else if(select?.value==="pool")select.value="water";
  const editor=typeof document.querySelector==="function"?document.querySelector("#dgSensBoundaryDetails"):null;
  normalizeWaterText(editor);
  const status=typeof document.querySelector==="function"?document.querySelector("#dgSensStatus"):null;
  normalizeWaterText(status);
  normalizeWaterText($("lcSens"));normalizeWaterText($("surfaceMapTools"));
  // Map appearance only: legacy pool footprints are drawn as Su, but stored
  // feature identities, geometry and scientific partition remain unchanged.
  const paths=state?.displayPaths||[];
  const nearest=window.DG_GIS_PNG_EXPORT?.nearestPresentationTypes;
  const paint=typeof nearest==="function"?nearest(state?.displayFeatures):[];
  const opacity=Math.max(0,Math.min(1,(Number(state?.opacity)||65)/100));
  for(let i=0;i<paths.length;i++){
   const item=paths[i],type=item.cls==="other"?paint[i]:item.cls;
   const color=type==="water"||type==="pool"?"#3b82f6":
    type==="building"?BUILDING_PRESENTATION_COLOR:
    type&&type!=="other"?(typeof DG_SENS_COLORS!=="undefined"?DG_SENS_COLORS[type]:null):null;
   if(color&&item.poly?.options?.fillColor!==color)item.poly.setStyle?.({fillColor:color});
   if(item.cls==="other"&&color&&item.poly?.options?.fillOpacity!==opacity)
    item.poly.setStyle?.({fillOpacity:opacity});
  }
 }
 let popupWaterMap=null;
 function syncWaterPopup(){
  const m=getMap();
  if(!m||m===popupWaterMap)return;
  if(popupWaterMap?.off)popupWaterMap.off("popupopen",onWaterPopup);
  popupWaterMap=m;m.on("popupopen",onWaterPopup);
 }
 function onWaterPopup(event){
  const root=event.popup?.getElement?.();
  if(!root)return;
  for(const button of root.querySelectorAll(".dg-sens-popup button")){
   const action=button.getAttribute?.("onclick")||"";
   if(/dgSensDecide\([^)]*['"]pool['"]\)/.test(action))button.remove();
  }
  normalizeWaterText(root.querySelector(".dg-sens-popup"));
 }

 const DRAW_CHOICES=[["water","Su"],["green","Yeşil alan"],["hard","Sert zemin"],["building","Bina"],["bare","Çıplak zemin"]];
 function chooseQuickBoundary(type){
  if(!DRAW_CHOICES.some(choice=>choice[0]===type))return false;
  const state=window.DG_LC_SENS?.state;
  if(!state?.draw||state.busy||state.saving||state.rawView)return false;
  if(typeof dgSensSetDrawType==="function")dgSensSetDrawType(type);
  // An unfinished drawing is an ephemeral preview; the new choice applies
  // to this polygon, never to saved features or raster-cell decisions.
  state.draw.type=type;
  if(typeof dgSensDrawRender==="function")dgSensDrawRender();
  if(typeof dgSensRenderPaintTools==="function")dgSensRenderPaintTools();
  enqueue();
  return true;
 }
 function finishAndContinueBoundary(){
  const state=window.DG_LC_SENS?.state;
  if(!state?.draw||state.draw.ring.length<4||state.busy||state.saving||
    typeof dgSensDrawFinish!=="function")return false;
  const drawing=state.draw,record=state.record,epoch=state.epoch;
  const token=++pendingBoundaryRestart;
  dgSensDrawFinish(); // the unchanged core clips, validates, saves and repartitions
  if(state.draw===drawing){return false;} // core rejected a self-intersecting polygon
  let attempts=0;
  const resume=()=>{
   if(token!==pendingBoundaryRestart||state.record!==record||state.epoch!==epoch||
      state.rawView||!editorActive()||state.draw)return;
   if(state.busy||state.saving||state.mergeBusy||state.exporting){
    if(++attempts<140)setTimeout(resume,420);
    return;
   }
   if(typeof dgSensDrawStart!=="function")return;
   dgSensDrawStart();
   // The old Start button opens the large boundary panel. The quick workflow
   // closes it immediately so the next polygon can be drawn on the map.
   if(typeof dgSensCloseMenus==="function")dgSensCloseMenus();
   enqueue();
  };
  setTimeout(resume,420);
  return true;
 }
 function syncQuickBoundary(){
  const host=$("surfaceMapTools"),state=window.DG_LC_SENS?.state;
  const draw=state?.draw;
  if(!host||!draw||!editorActive()||typeof document.createElement!=="function"){
   host?.querySelector?.("#dgUxBoundaryDock")?.remove?.();return;
  }
  let dock=host.querySelector?.("#dgUxBoundaryDock");
  if(!dock){
   dock=el("div","dg-ux-boundary-dock");dock.id="dgUxBoundaryDock";
   dock.setAttribute("role","group");dock.setAttribute("aria-label","Hızlı sınır çizimi");
   const chooser=el("select","dg-ux-boundary-choice");chooser.id="dgUxBoundaryClass";
   chooser.setAttribute("aria-label","Çizilecek sınır sınıfı");
   for(const [value,label] of DRAW_CHOICES){
    const option=document.createElement("option");option.value=value;option.textContent=label;
    chooser.append(option);
   }
   chooser.addEventListener("change",()=>chooseQuickBoundary(chooser.value));
   const finish=el("button","dg-png-btn primary sm dg-ux-boundary-finish","✓");
   finish.id="dgUxBoundaryFinish";finish.type="button";
   finish.setAttribute("aria-label","Dört köşe tamamlandı: sınırı kaydet ve çizime devam et");
   finish.title="Sınırı tamamla ve yeni çizime devam et";
   finish.addEventListener("click",()=>finishAndContinueBoundary());
   const info=el("span","dg-ux-boundary-count");
   info.id="dgUxBoundaryCount";info.setAttribute("aria-live","polite");
   dock.append(chooser,finish,info);
   dock.addEventListener("click",event=>event.stopPropagation());
   dock.addEventListener("pointerdown",event=>event.stopPropagation());
   host.append(dock);
  }
  const current=DRAW_CHOICES.some(choice=>choice[0]===draw.type)?draw.type:"water";
  const chooser=dock.querySelector("#dgUxBoundaryClass");
  if(chooser&&chooser.value!==current)chooser.value=current;
  const count=draw.ring.length,finish=dock.querySelector("#dgUxBoundaryFinish");
  if(finish){
   finish.hidden=count<4;finish.disabled=count<4||state.busy||state.saving;
  }
  txt(dock.querySelector("#dgUxBoundaryCount"),count+" köşe · "+(count<4?"4 köşeden sonra ✓":"✓ hazır"));
 }
 function syncSliderPaint(){
  const sliders=$("lcSens")?.querySelectorAll?.('input.dg-sens-slider[id^="dgSensRange-"]')||[];
  for(const slider of sliders)slider.style?.setProperty?.("--dg-ux-slider-fill",Math.max(0,Math.min(100,Number(slider.value)||0))+"%");
 }
 function sync(){
  // During hand drawing/repartition the locked engine recreates the rail for
  // every vertex. Running the full GIS panels + NDVI tally per mutation caused
  // long main-thread stalls. Keep only the small drawing dock reactive here.
  const state=window.DG_LC_SENS?.state;
  if(state?.draw||state?.busy||state?.saving||state?.mergeBusy){
   syncQuickBoundary();
   return;
  }
  syncPark();
  syncBrushChoices();
  syncWaterBoundary();
  syncWaterPopup();
  syncQuickBoundary();
  syncSurfaceReport();
  syncWaterSurfaceRows();
  syncWaterStatusSummary();
  syncSliderPaint();
  syncGroupLayout();
  syncSpecies();
  syncMapTools();
  syncNdviMapInfo();
  const bar=$("surfaceMenuBar");
  if(bar)bar.querySelectorAll(":scope > details[open]").forEach(menuPosition);
  if(mapTool&&mapInstance&&getMap()!==mapInstance){closeTool();setStatus("Harita değiştiği için geçici ölçüm kapatıldı.");}
 }
 function init(){
  const bar=$("surfaceMenuBar");
  if(!bar||!$("parkInfo")||!$("liveAnalysis"))return;
  if(typeof MutationObserver!=="function")return; // test/no-DOM fallback; browsers provide this API.
  observer=new MutationObserver(enqueue);
  for(const id of ["surfaceMenuBar","parkInfo","liveAnalysis","landCoverReport","lcSens","surfaceMapTools"]){
   const node=$(id);if(node)observer.observe(node,{childList:true,subtree:id!=="surfaceMapTools"});
  }
  bar.addEventListener("toggle",event=>{
   if(event.target?.matches?.(":scope > .dg-editor-menu")&&event.target.open)openMenu(event.target);
  },true);
  window.addEventListener("resize",()=>{bar.querySelectorAll(":scope > details[open]").forEach(menuPosition);},{passive:true});
  window.visualViewport?.addEventListener("resize",()=>{bar.querySelectorAll(":scope > details[open]").forEach(menuPosition);},{passive:true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&mapTool){closeTool();setStatus("Geçici ölçüm kapatıldı.");}});
  document.addEventListener("input",e=>{
   const input=e.target;
   if(input?.matches?.('#lcSens input.dg-sens-slider[id^="dgSensRange-"]'))
    input.style.setProperty("--dg-ux-slider-fill",Math.max(0,Math.min(100,Number(input.value)||0))+"%");
  },true);
  // A user may abandon an automatic continuation while the original
  // repartition/save is still in flight.
  document.addEventListener("click",event=>{
   if(event.target?.closest?.('button[onclick*="dgSensHandMode"],button[onclick*="dgSensDrawCancel"]'))
    pendingBoundaryRestart++;
  },true);
  // If a previous class filter excludes green polygons, NDVI would appear in
  // the report but be invisible on the actual map. Clear only this view filter
  // when enabling NDVI; never alter class areas, records or raster values.
  document.addEventListener("click",e=>{
   if(!e.target?.closest?.('button[onclick*="dgSensToggleVegetation"]'))return;
   const state=window.DG_LC_SENS?.state;
   if(state&&!state.vegetationView){
    if(state.focus&&state.focus!=="green"&&typeof dgSensFocus==="function")dgSensFocus(null);
    if(state.showCand===false&&typeof dgSensToggleCand==="function")dgSensToggleCand(true);
   }
  },true);
  sync();
 }
 window.DG_GIS_WORKSPACE_UI={sync,closeTool,activateTool,pathLength,areaMeters,waterPresentationAreas,chooseQuickBoundary,finishAndContinueBoundary,syncQuickBoundary};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();