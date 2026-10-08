/* DendroGeo GIS Toolkit — separate map overlay; no changes to LULC engine.
 * GeoJSON/KML/CSV are user drawings only, never approved analyses.
 * All DOM strings with user/server values use textContent, not innerHTML.
 */
(function(){
"use strict";
const geo=window.DG_GIS_GEO;
if(!geo)return;
const state={mode:null,points:[],measureLayer:null,lastKind:null,marker:null,mapRef:null,scale:null,overlay:null,menu:null,notice:"Harita araçları hazır.",queryBusy:false,bookmarks:[]};
const $=id=>document.getElementById(id);
const toastSafe=(text,type="info")=>{if(typeof window.toast==="function")window.toast(text,type);else console.info(text);};
const isEditing=()=>Boolean((typeof PARK_MODE!=="undefined"&&PARK_MODE)||
 (typeof DG_SENS!=="undefined"&&(DG_SENS.brush||DG_SENS.draw||DG_SENS.objectPick||DG_SENS.objectPreview||DG_SENS.busy||DG_SENS.saving)));
function activeMap(){
 try{return typeof map!=="undefined"&&map&&typeof map.on==="function"?map:null;}catch{return null;}
}
function el(name,cls,text){
 const e=document.createElement(name);
 if(cls)e.className=cls;
 if(text!==undefined)e.textContent=text;
 return e;
}
function button(label,click,cls="ghost sm"){
 const b=el("button","dg-png-btn "+cls,label);b.type="button";b.addEventListener("click",click);return b;
}
function field(label,id,placeholder){
 const c=el("label","dg-gis-field"),t=el("span","dg-png-label",label),input=el("input","dg-png-input");input.id=id;input.placeholder=placeholder;
 c.append(t,input);return c;
}
function group(parent,title,description){
 const s=el("section","dg-gis-group");
 s.append(el("h4","dg-gis-group-title",title));
 if(description)s.append(el("p","dg-gis-help",description));
 parent.append(s);return s;
}
function row(p){const r=el("div","dg-gis-actions");p.append(r);return r;}
function setStatus(msg){
 state.notice=msg;
 const o=$("dgGisStatus"),f=$("dgGisFloatingStatus");
 if(o)o.textContent=msg;
 if(f)f.textContent=state.mode?"GIS · "+msg:"";
}
function openPanel(){
 const bar=$("surfaceMenuBar");
 if(!bar||state.menu&&state.menu.isConnected)return;
 const menu=el("details","dg-editor-menu dg-gis-menu");
 menu.dataset.menuOrder="35";menu.dataset.menuOwner="gis";
 menu.id="dgGisMenu";
 const summary=el("summary");
 summary.innerHTML=window.DG_EDITOR_UI?.menuLabel?.("view","GIS Araçları")||"GIS Araçları";
 const body=el("div","dg-editor-menu-body dg-gis-pane");
 body.append(el("header","dg-gis-heading"));
 const heading=body.lastElementChild;
 heading.append(el("strong","", "GIS çalışma araçları"),el("small","", "Ölçüm · sorgu · koordinat · QGIS"));
 const search=group(body,"Konum bul","Koordinat (enlem, boylam) veya yer adıyla arama.");
 const searchRow=row(search);
 const q=field("ENLEM, BOYLAM VEYA YER ADI","dgGisSearch","39.99, 32.65 veya park adı");
 searchRow.append(q,button("Ara",searchPlace,"primary sm"));
 q.querySelector("input").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchPlace();}});
 const m=group(body,"Ölçüm ve sorgulama","Haritaya tıklayarak köşe ekle. Çift tıkla tamamla; dokunmatik cihazda ✓ kullan.");
 const actions=row(m);
 actions.append(button("◎ Koordinat",()=>start("coordinate")),button("↔ Mesafe",()=>start("line")),button("⬡ Alan",()=>start("area")),button("ⓘ Nesne",()=>start("identify")));
 const more=row(m);
 more.append(button("↶ Son nokta",undo),button("✓ Bitir",finish,"primary sm"),button("✕ Temizle",clear));
 const result=el("div","dg-gis-result");result.id="dgGisResult";
 result.setAttribute("aria-live","polite");m.append(result);
 const opts=row(m);
 opts.append(button("⎘ Sonucu kopyala",copyResult),button("↗ Parkı göster",fitPark));
 const expo=group(body,"QGIS dışa aktarım","Yalnızca geçici ölçüm geometrisini EPSG:4326 biçiminde dışa aktarır.");
 const outputs=row(expo);
 outputs.append(button("GeoJSON",()=>exportFile("geojson")),button("KML",()=>exportFile("kml")),button("CSV",()=>exportFile("csv")));
 const layers=group(body,"Harita ve katmanlar","Canlı katmanları mevcut anahtarlarla yönet; analiz değerleri değişmez.");
 const basemap=el("label","dg-gis-field");
 basemap.append(el("span","dg-png-label","ALTLIK"));
 const select=el("select","dg-png-select");select.id="dgGisBasemap";
 for(const [value,label] of [["osm","OSM Sokak"],["sat","Uydu"],["topo","Topoğrafik"]]){
  const option=el("option","",label);option.value=value;select.append(option);
 }
 select.addEventListener("change",()=>{if(typeof switchBaseLayer==="function")switchBaseLayer(select.value);});
 basemap.append(select);layers.append(basemap);
 const toggles=row(layers);
 toggles.append(button("▦ Grid aç/kapat",()=>proxyToggle("togGrid")),button("● Waypoint aç/kapat",()=>proxyToggle("togWp")));
 const legend=el("div","dg-gis-legend");legend.id="dgGisLegend";layers.append(legend);
 layers.append(button("↻ Katman listesini güncelle",updateLayers));
 const nav=group(body,"Konum ve saha","Geçici yer işaretleri yalnız bu tarayıcıda saklanır.");
 const bookmarkName=field("YER İŞARETİ ADI","dgGisBookmarkName","Örneğin: kuzey giriş");
 nav.append(bookmarkName);
 const bookmarkActions=row(nav);
 bookmarkActions.append(button("☆ Konumu kaydet",saveBookmark),button("◎ Konumumu bul",locate),button("▣ Ölçek",toggleScale));
 const bookmarkList=el("div","dg-gis-bookmarks");bookmarkList.id="dgGisBookmarks";nav.append(bookmarkList);
 const status=el("p","dg-gis-status","Harita araçları hazır.");status.id="dgGisStatus";status.setAttribute("role","status");
 body.append(status);
 menu.append(summary,body);
 menu.addEventListener("toggle",()=>{if(menu.open){bar.querySelectorAll("details[open]").forEach(other=>{if(other!==menu)other.open=false;});updateLayers();render();}});
 const following=[...bar.children].find(n=>Number(n.dataset.menuOrder)>35);
 bar.insertBefore(menu,following||null);
 state.menu=menu;
}
function proxyToggle(id){
 const input=$(id);
 if(!input){setStatus("Katman bu parkta henüz oluşturulmadı.");return;}
 input.click();
 setStatus("Katman görünürlüğü güncellendi.");
}
function updateLayers(){
 const box=$("dgGisLegend");if(!box)return;
 box.replaceChildren();
 const selection=typeof DG_SENS!=="undefined"?DG_SENS:null;
 const colors=typeof DG_SENS_COLORS!=="undefined"?DG_SENS_COLORS:{};
 const types=window.DG_SURFACE_REVIEW?.types||{};
 const panel=el("div","dg-gis-legend-title","Yüzey sınıfları · lejant");
 box.append(panel);
 const keys=["green","hard","building","water","pool","bare"];
 for(const key of keys){
  if(!types[key])continue;
  const item=el("div","dg-gis-legend-item"),swatch=el("i","dg-gis-swatch");
  swatch.style.backgroundColor=colors[key]||"var(--green)";
  item.append(swatch,el("span","",types[key].label||key));box.append(item);
 }
 const extra=el("p","dg-gis-help");
 extra.textContent=selection?.record?"Katmanlar analiz önizlemesinden okunur; harita ayarları bilimsel hesabı değiştirmez.":"Park analizi açıldığında yüzey lejandı kullanılabilir.";
 box.append(extra);
 const mapObj=activeMap(),sel=$("dgGisBasemap");
 if(sel&&mapObj){
  let type="osm";
  mapObj.eachLayer(l=>{if(l._dgBase)type=l._dgBase;});
  sel.value=type;
 }
}
function ensureMap(){
 const m=activeMap();
 if(!m){setStatus("Önce Canlı Harita sekmesini açın.");return null;}
 if(state.mapRef!==m){
  detach();
  state.mapRef=m;
  state.overlay=L.layerGroup().addTo(m);
  m.on("click",onMapClick);
  m.on("dblclick",onDoubleClick);
  m.on("unload",()=>{detach();state.mapRef=null;});
 }
 return m;
}
function detach(){
 if(state.mapRef){state.mapRef.off("click",onMapClick);state.mapRef.off("dblclick",onDoubleClick);}
 if(state.overlay){state.overlay.clearLayers();if(state.mapRef?.hasLayer(state.overlay))state.mapRef.removeLayer(state.overlay);}
 if(state.scale){state.scale.remove();state.scale=null;}
 state.overlay=null;
}
function ensureFloat(){
 let node=$("dgGisFloat");
 const workspace=$("surfaceMapWorkspace");
 if(!workspace)return;
 if(!node){
  node=el("div","dg-gis-float");node.id="dgGisFloat";
  const status=el("span","dg-gis-float-label");status.id="dgGisFloatingStatus";status.setAttribute("aria-live","polite");
  node.append(status,button("✓",finish,"primary sm"),button("↶",undo),button("✕",clear));
  workspace.append(node);
 }
 node.hidden=!state.mode||state.mode==="identify"||state.mode==="coordinate";
}
function start(mode){
 if(isEditing()){setStatus("Önce fırça, sınır çizimi veya park seçme aracından çıkın.");toastSafe("GIS sorgusu için önce düzenleme aracını kapatın.","warn");return;}
 const m=ensureMap();if(!m)return;
 if(state.mode==="line"||state.mode==="area")stopMode();
 if(["line","area","coordinate","identify"].indexOf(mode)===-1)return;
 state.mode=mode;state.lastKind=mode==="area"?"area":"line";state.points=[];
 if((mode==="line"||mode==="area")&&m.doubleClickZoom?.enabled())m.doubleClickZoom.disable();
 draw();ensureFloat();
 const instructions={line:"Mesafe: haritada köşelere tıkla; çift tıkla veya ✓ ile bitir.",area:"Alan: en az üç köşe seç; çift tıkla veya ✓ ile bitir.",coordinate:"Koordinat: haritadaki konuma dokun.",identify:"Nesne: haritadaki park veya yüzey geometrisine dokun."};
 setStatus(instructions[mode]);render();
}
function stopMode(){
 if(!state.mode)return;
 state.mode=null;
 if(state.mapRef?.doubleClickZoom&&!state.mapRef.doubleClickZoom.enabled())state.mapRef.doubleClickZoom.enable();
 ensureFloat();render();
}
function onMapClick(e){
 if(!state.mode||!e?.latlng)return;
 if(isEditing()){stopMode();setStatus("Düzenleme başladı; GIS sorgusu durduruldu.");return;}
 if(state.mode==="coordinate"){showCoordinate(e.latlng);stopMode();return;}
 if(state.mode==="identify"){identify(e.latlng);stopMode();return;}
 const p=geo.point(e.latlng);
 if(state.points.length&&geo.distance(state.points[state.points.length-1],p)<.05)return;
 if(state.points.length>=250){setStatus("En fazla 250 köşe işlenebilir.");return;}
 state.points.push(p);
 draw();render();
}
function onDoubleClick(){if(state.mode==="line"||state.mode==="area")finish();}
function draw(){
 if(!state.overlay||!state.mapRef)return;
 state.overlay.clearLayers();
 if(!state.points.length)return;
 const p=state.points.map(x=>[x.lat,x.lng]);
 for(const coords of p)L.circleMarker(coords,{radius:5,weight:2,color:"var(--green)",fillOpacity:.95,interactive:false}).addTo(state.overlay);
 if(p.length>1)L.polyline(p,{weight:3,color:"#0e7490",dashArray:"6,4",interactive:false}).addTo(state.overlay);
 if(state.mode==="area"&&p.length>=3)L.polygon(p,{color:"#0e7490",weight:2,fillOpacity:.12,interactive:false}).addTo(state.overlay);
}
function clear(){
 stopMode();state.points=[];state.lastKind=null;state.coordinateText=null;
 if(state.overlay)state.overlay.clearLayers();
 const result=$("dgGisResult");if(result)result.replaceChildren();
 setStatus("Geçici çizim temizlendi. Kaydedilmiş analiz değişmedi.");
}
function undo(){
 if(!state.points.length)return;
 state.points.pop();draw();render();
 setStatus("Son nokta geri alındı.");
}
function finish(){
 if(state.mode!=="line"&&state.mode!=="area")return;
 const needed=state.mode==="area"?3:2;
 if(state.points.length<needed){setStatus("Ölçüm için en az "+needed+" köşe gerekli.");return;}
 state.lastKind=state.mode;draw();const kind=state.mode;stopMode();
 setStatus(kind==="area"?"Alan ölçümü tamamlandı.":"Mesafe ölçümü tamamlandı.");
 render();
}
function lastKind(){
 if(state.mode==="area")return "area";
 return state.points.length>=3&&state.lastKind==="area"?"area":"line";
}
function render(){
 const box=$("dgGisResult");if(!box)return;
 box.replaceChildren();
 const points=state.points;
 if(!points.length){box.append(el("p","dg-gis-help","Henüz ölçüm noktası yok."));return;}
 const kind=state.mode==="area"?"area":state.lastKind==="area"&&state.mode===null?"area":"line";
 const d=geo.pathLength(points,kind==="area"&&points.length>=3);
 const head=el("strong","",String(points.length)+" nokta · "+geo.fmtDistance(d));
 box.append(head);
 if(kind==="area"&&points.length>=3)box.append(el("span","", "Alan ≈ "+geo.fmtArea(geo.polygonArea(points))));
 if(points.length>=2)box.append(el("span","", "İlk doğrultu "+geo.bearing(points[0],points[1]).toFixed(1)+"°"));
 box.append(el("small","dg-gis-help","Bağımsız, yaklaşık WGS84 ölçümü; onaylı arazi analizini değiştirmez."));
}
function showCoordinate(latlng){
 const p=geo.point(latlng);let utm=null;try{utm=geo.utm(p);}catch{}
 const text=p.lat.toFixed(7)+", "+p.lng.toFixed(7);
 state.coordinateText=text;
 const box=$("dgGisResult");if(!box)return;
 box.replaceChildren();
 box.append(el("strong","",text));
 box.append(el("span","",geo.dms(p.lat,true)+" · "+geo.dms(p.lng,false)));
 if(utm)box.append(el("span","", "EPSG:"+utm.epsg+" · "+utm.easting.toFixed(2)+" E · "+utm.northing.toFixed(2)+" N"));
 box.append(button("Koordinatı kopyala",()=>copyText(text)));
 setStatus("Koordinat okundu · EPSG:4326.");
}
function identify(p){
 const box=$("dgGisResult");if(!box)return;
 box.replaceChildren();let found=0;
 const ll=geo.point(p);
 if(typeof PARK_POLY!=="undefined"&&Array.isArray(PARK_POLY)&&PARK_POLY.length>=3&&geo.ringContains(ll,PARK_POLY)){
  box.append(el("strong","", "Park sınırı içinde"));
  box.append(el("span","", typeof PARK_CANDS!=="undefined"&&PARK_CANDS.length?String(PARK_CANDS[0].name||"Seçili park"):"Seçili park"));
  found++;
 }
 const sens=typeof DG_SENS!=="undefined"?DG_SENS:null;
 const paths=sens?.displayPaths;
 if(Array.isArray(paths)){
  for(const item of paths.slice(0,30)){
   if(!item?.poly?.getLatLngs||!item.poly.getBounds?.().contains(p))continue;
   const polygons=item.poly.getLatLngs();
   const contains=ring=>Array.isArray(ring)&&ring.length>=3&&ring[0]?.lat!==undefined&&geo.ringContains(ll,ring);
   let match=false;
   for(const poly of polygons){if(contains(poly)){match=true;break;}if(Array.isArray(poly))for(const ring of poly){if(contains(ring)){match=true;break;}}if(match)break;}
   if(match){
    const name=window.DG_SURFACE_REVIEW?.types?.[item.cls]?.label||item.cls;
    box.append(el("strong","", "Yüzey: "+name));found++;break;
   }
  }
 }
 if(!found)box.append(el("strong","", "Kayıtlı nesne bulunamadı."));
 box.append(el("span","",ll.lat.toFixed(7)+", "+ll.lng.toFixed(7)));
 box.append(el("small","dg-gis-help","Bu sorgu yalnız mevcut harita geometrisini inceler; sınıflandırma yapmaz."));
 setStatus(found?"Harita nesnesi incelendi.":"Bu konumda uygun nesne bulunamadı.");
}
function fitPark(){
 const m=ensureMap();if(!m)return;
 if(typeof PARK_POLY!=="undefined"&&Array.isArray(PARK_POLY)&&PARK_POLY.length>=3){
  m.fitBounds(L.latLngBounds(PARK_POLY),{padding:[24,24],maxZoom:18});
  setStatus("Park sınırına odaklanıldı.");
 }else setStatus("Önce bir park seçin.");
}
function copyText(value){
 if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(()=>setStatus("Panoya kopyalandı.")).catch(()=>setStatus("Panoya erişilemedi."));return;}
 const t=document.createElement("textarea");t.value=value;t.style.position="fixed";t.style.opacity="0";document.body.append(t);t.select();
 const ok=document.execCommand("copy");t.remove();setStatus(ok?"Panoya kopyalandı.":"Panoya erişilemedi.");
}
function copyResult(){
 if(state.points.length){const last=state.points[state.points.length-1];copyText(last.lat.toFixed(7)+", "+last.lng.toFixed(7));}
 else if(state.coordinateText)copyText(state.coordinateText);
 else setStatus("Önce koordinat veya ölçüm noktası seçin.");
}
function exportFile(format){
 if(state.points.length<2){setStatus("Dışa aktarmak için en az iki nokta seçin.");return;}
 const kind=state.lastKind==="area"?"area":"line",fc=geo.geojson(state.points,kind,"DendroGeo GIS ölçüm");
 let body,ext,mime;
 if(format==="geojson"){body=JSON.stringify(fc,null,2);ext="geojson";mime="application/geo+json";}
 else if(format==="kml"){body=geo.kml(fc);ext="kml";mime="application/vnd.google-earth.kml+xml";}
 else if(format==="csv"){
  body="vertex,latitude,longitude\n"+state.points.map((p,i)=>[i+1,p.lat.toFixed(8),p.lng.toFixed(8)].join(",")).join("\n")+"\n";
  ext="csv";mime="text/csv;charset=utf-8";
 }else return;
 const url=URL.createObjectURL(new Blob([body],{type:mime}));
 const a=el("a");a.href=url;a.download="dendrogeo_gis_olcum."+ext;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
 setStatus(ext.toUpperCase()+" dosyası hazırlandı; analiz kaydı değiştirilmedi.");
}
function parseCoords(query){
 const match=query.trim().match(/^([+-]?\d+(?:[.,]\d+)?)\s*[,;\s]\s*([+-]?\d+(?:[.,]\d+)?)$/);
 if(!match)return null;
 return geo.point({lat:Number(match[1].replace(",",".")),lng:Number(match[2].replace(",","."))});
}
async function searchPlace(){
 const q=document.getElementById("dgGisSearch")?.value.trim()||"";
 if(!q)return;
 let p=null;
 try{p=parseCoords(q);}catch(e){setStatus(e.message);return;}
 if(p){const m=ensureMap();if(m){m.setView([p.lat,p.lng],Math.max(16,m.getZoom()));showCoordinate(p);}return;}
 if(q.length<3||q.length>150){setStatus("Yer adı 3–150 karakter olmalı.");return;}
 if(state.queryBusy)return;
 state.queryBusy=true;setStatus("Yer aranıyor...");
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),9000);
 try{
  const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(q);
  const resp=await fetch(url,{signal:abort.signal,headers:{"Accept":"application/json"}});
  if(!resp.ok)throw Error("Adres arama servisi yanıt vermedi.");
  const results=await resp.json(),r=Array.isArray(results)?results[0]:null;
  if(!r)throw Error("Konum bulunamadı.");
  p=geo.point({lat:Number(r.lat),lng:Number(r.lon)});
  const m=ensureMap();if(!m)return;
  m.setView([p.lat,p.lng],16);
  showCoordinate(p);
  setStatus("Konum bulundu · © OpenStreetMap katkıcıları.");
 }catch(e){setStatus(e.name==="AbortError"?"Yer arama zaman aşımı.":String(e.message||e));}
 finally{clearTimeout(timer);state.queryBusy=false;}
}
function loadBookmarks(){
 try{const list=JSON.parse(localStorage.getItem("dg-gis-bookmarks-v1")||"[]");
 state.bookmarks=Array.isArray(list)?list.filter(b=>b&&typeof b.name==="string"&&Number.isFinite(b.lat)&&Number.isFinite(b.lng)).slice(0,12):[];
 }catch{state.bookmarks=[];}showBookmarks();
}
function persistBookmarks(){
 try{localStorage.setItem("dg-gis-bookmarks-v1",JSON.stringify(state.bookmarks));}
 catch{setStatus("Yer işareti bu cihazda saklanamadı.");}
 showBookmarks();
}
function saveBookmark(){
 const m=ensureMap();if(!m)return;
 const name=(document.getElementById("dgGisBookmarkName")?.value||"").trim().slice(0,80);
 if(!name){setStatus("Yer işareti adı girin.");return;}
 const p=m.getCenter();
 state.bookmarks.unshift({name,lat:p.lat,lng:p.lng});
 state.bookmarks=state.bookmarks.slice(0,12);persistBookmarks();
 setStatus("Yer işareti yalnız bu cihazda kaydedildi.");
}
function showBookmarks(){
 const box=$("dgGisBookmarks");if(!box)return;
 box.replaceChildren();
 if(!state.bookmarks.length){box.append(el("p","dg-gis-help","Henüz kaydedilmiş konum yok."));return;}
 state.bookmarks.forEach((b,i)=>{
  const line=el("div","dg-gis-bookmark"),name=button("📍 "+b.name,()=>{
   const m=ensureMap();if(m)m.setView([b.lat,b.lng],Math.max(m.getZoom(),16));
  }),del=button("✕",()=>{state.bookmarks.splice(i,1);persistBookmarks();},"ghost sm");
  del.setAttribute("aria-label",b.name+" konumunu sil");
  line.append(name,del);box.append(line);
 });
}
function locate(){
 const m=ensureMap();if(!m)return;
 if(!navigator.geolocation){setStatus("Cihaz konumu desteklenmiyor.");return;}
 setStatus("Konum izni bekleniyor...");
 navigator.geolocation.getCurrentPosition(pos=>{
  if(activeMap()!==m)return;
  const p={lat:pos.coords.latitude,lng:pos.coords.longitude};
  m.setView([p.lat,p.lng],17);
  if(state.marker)m.removeLayer(state.marker);
  state.marker=L.circleMarker([p.lat,p.lng],{radius:7,color:"#0e7490",weight:2,fillOpacity:.9}).addTo(m);
  state.marker.bindPopup("Cihaz konumu · doğruluk ±"+Math.round(pos.coords.accuracy)+" m");
  setStatus("Cihaz konumu · ±"+Math.round(pos.coords.accuracy)+" m (geçici).");
 },err=>setStatus("Cihaz konumu alınamadı: "+err.message),{enableHighAccuracy:true,timeout:12000,maximumAge:10000});
}
function toggleScale(){
 const m=ensureMap();if(!m)return;
 if(state.scale){state.scale.remove();state.scale=null;setStatus("Ölçek çubuğu kapatıldı.");}
 else{state.scale=L.control.scale({metric:true,imperial:false,maxWidth:150,position:"bottomleft"}).addTo(m);setStatus("Metre/kilometre ölçeği açıldı.");}
}
function onKey(e){
 if(e.key==="Escape"&&state.mode){stopMode();setStatus("GIS işlemi durduruldu.");}
}
function dgGisToolkitInit(){
 const bar=$("surfaceMenuBar");
 if(!bar||typeof bar.append!=="function")return;
 openPanel();loadBookmarks();ensureFloat();
 if(typeof MutationObserver!=="undefined"){
  const obs=new MutationObserver(()=>{if(!$("dgGisMenu")){state.menu=null;openPanel();loadBookmarks();}ensureFloat();});
  obs.observe(bar,{childList:true});
 }
 document.addEventListener("keydown",onKey);
 window.DG_GIS_TOOLKIT=Object.freeze({start,finish,clear,undo,fitPark,exportFile,open:()=>{openPanel();if(state.menu)state.menu.open=true;}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",dgGisToolkitInit,{once:true});else dgGisToolkitInit();
})();
