/* DendroGeo GIS workspace v2 · UI-only. No surface classification, raster,
 * sensitivity, saved result or map layer state may be modified here.
 * The original DOM nodes and onclick handlers are always retained. */
(function(){
 "use strict";
 let pending=0, observer=null, mapTool="",mapInstance=null,drawLayer=null,drawPoints=[],clickHandler=null;
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
  menu.dataset.menuOwner="park";
  menu.dataset.menuOrder="45";
  const summary=el("summary");
  summary.innerHTML=window.DG_EDITOR_UI?.menuLabel?.("file","Rapor & Çıktı")||"Rapor & Çıktı";
  const panel=el("div","dg-editor-menu-body");
  panel.innerHTML=window.DG_EDITOR_UI?.panelHead?.("file","Harita çıktısı","Altlığı ve PNG içeriğini seç, ardından indir.")||"<strong>Harita çıktısı</strong>";
  const note=el("p","dg-ux-option-note","İndirme ayarları analizin hesaplarını veya kayıtlı sonuçları değiştirmez.");
  panel.append(note);
  menu.append(summary,panel);
  menu.addEventListener("toggle",()=>{if(menu.open)openMenu(menu);});
  return menu;
 }
 function syncPark(){
  const bar=$("surfaceMenuBar"),exportCard=$("parkRasterExport"),layer=$("parkLayerTools");
  if(!bar||!exportCard||!layer)return;
  let menu=bar.querySelector(".dg-ux-output-menu");
  if(!menu){menu=makeOutput();}
  const next=[...bar.children].find(n=>n!==menu&&Number(n.dataset.menuOrder)>45)||null;
  if(menu.parentElement!==bar||menu.nextElementSibling!==next)bar.insertBefore(menu,next);
  const panel=menu.querySelector(":scope > .dg-editor-menu-body");
  if(exportCard.parentElement!==panel)panel.append(exportCard);
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
   let node=head.nextElementSibling;
   for(let i=0;i<6&&node;i++,node=node.nextElementSibling)
    if(node.firstElementChild?.querySelector("span"))node.classList.add("dg-ux-species-row");
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
  if(mapInstance&&drawLayer)mapInstance.removeLayer(drawLayer);
  mapInstance=null;drawLayer=null;clickHandler=null;drawPoints=[];mapTool="";
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
  if(mapTool==="area"&&drawPoints.length>2)L.polygon(drawPoints,{...style,fillOpacity:.1}).addTo(drawLayer);
  const length=pathLength(drawPoints);
  setStatus(drawPoints.length+" köşe · "+(mapTool==="area"?(drawPoints.length>=3?unit(areaMeters(drawPoints),true):"Alan için en az 3 köşe seç"):"Mesafe: "+unit(length)));
 }
 function activateTool(mode){
  const m=getMap();
  if(!m){setStatus("Harita hazır değil. Canlı Harita'yı açıp yeniden deneyin.");return;}
  if(editorActive()){
   setStatus("Yüzey düzeltmesi açıkken ölçüm devre dışıdır. Önce El / harita görünümüne dönün.");
   return;
  }
  // The existing park-selection listener runs on map.click. Do not let a
  // measurement click accidentally replace the currently selected park.
  if(typeof PARK_MODE!=="undefined"&&PARK_MODE){
   setStatus("Ölçüm için önce Park Analizi Modu'nu kapatın. Seçili park ve analiz silinmez.");
   return;
  }
  if(mapTool===mode){closeTool();setStatus("Ölçüm kapatıldı.");return;}
  closeTool();mapInstance=m;mapTool=mode;drawLayer=L.layerGroup().addTo(m);
  clickHandler=e=>{drawPoints.push(e.latlng);redraw();};
  m.on("click",clickHandler);
  $("dgUxMapTools")?.querySelector('button[data-tool="'+mode+'"]')?.setAttribute("aria-pressed","true");
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
 function sync(){
  syncPark();
  syncSpecies();
  syncMapTools();
  const bar=$("surfaceMenuBar");
  if(bar)bar.querySelectorAll(":scope > details[open]").forEach(menuPosition);
  if(mapTool&&editorActive()){closeTool();setStatus("Analiz düzenleme moduna geçildiği için geçici ölçüm kapatıldı.");}
 }
 function init(){
  const bar=$("surfaceMenuBar");
  if(!bar||!$("parkInfo")||!$("liveAnalysis"))return;
  if(typeof MutationObserver!=="function")return; // test/no-DOM fallback; browsers provide this API.
  observer=new MutationObserver(enqueue);
  for(const id of ["surfaceMenuBar","parkInfo","liveAnalysis"])observer.observe($(id),{childList:true,subtree:true});
  bar.addEventListener("toggle",event=>{
   if(event.target?.matches?.(":scope > .dg-editor-menu")&&event.target.open)openMenu(event.target);
  },true);
  window.addEventListener("resize",()=>{bar.querySelectorAll(":scope > details[open]").forEach(menuPosition);},{passive:true});
  window.visualViewport?.addEventListener("resize",()=>{bar.querySelectorAll(":scope > details[open]").forEach(menuPosition);},{passive:true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&mapTool){closeTool();setStatus("Geçici ölçüm kapatıldı.");}});
  sync();
 }
 window.DG_GIS_WORKSPACE_UI={sync,closeTool,pathLength,areaMeters};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();