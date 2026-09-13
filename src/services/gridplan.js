"use strict";
/* ===== DendroGeo v2 · src/services/gridplan.js =====
Park sınırı algılama (Overpass API) + grid tabanlı ölçüm planlama */

let PARK_POLY=null,PARK_LAYER=null,PARK_MODE=false,PARK_CLICK_BOUND=false;
const GRID_CELLS=[],GRID_LAYER=null;

const OVERPASS_URLS=[
 "https://overpass-api.de/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter"
];

// 1) Overpass: tıklanan noktanın etrafındaki parkı bul
async function queryPark(lat,lon,radius=150){
 const q=`[out:json][timeout:15];(way["leisure"~"park|garden|nature_reserve"](around:${radius},${lat},${lon});relation["leisure"~"park|garden|nature_reserve"](around:${radius},${lat},${lon}););out geom;`;
 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q));
   if(!res.ok)continue;
   const json=await res.json();
   const cands=[];
   for(const el of (json.elements||[])){
    const poly=extractPoly(el);
    if(!poly||poly.length<3)continue;
    cands.push({poly,name:(el.tags&&el.tags.name)||null,area:polyArea(poly)});
   }
   if(!cands.length)continue;
   const inside=cands.filter(c=>pointInPolygon(lat,lon,c.poly));
   const pool=inside.length?inside:cands;
   pool.sort((a,b)=>a.area-b.area);
   return pool[0];
  }catch(e){}
 }
 return null;
}

// 2) OSM elemanından polygon çıkar
function extractPoly(el){
 if(el.type==="way"&&el.geometry)return el.geometry.map(g=>[g.lat,g.lon]);
 if(el.type==="relation"&&el.members){
  const outer=el.members.filter(m=>m.role==="outer"&&m.geometry);
  if(outer.length===1)return outer[0].geometry.map(g=>[g.lat,g.lon]);
  if(outer.length>1){let pts=[];outer.forEach(m=>{pts=pts.concat(m.geometry.map(g=>[g.lat,g.lon]));});return pts;}
 }
 return null;
}

// 3) Nokta polygon içinde mi (ray casting)
function pointInPolygon(lat,lon,poly){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const yi=poly[i][0],xi=poly[i][1],yj=poly[j][0],xj=poly[j][1];
  if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inside=!inside;
 }
 return inside;
}

// 4) Polygon alanı (m²) — equirectangular yaklaşım
function polyArea(poly){
 const lat0=poly[0][0]*Math.PI/180;
 const kx=111320*Math.cos(lat0),ky=110540;
 let a=0;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  a+=(poly[j][1]*kx)*(poly[i][0]*ky)-(poly[i][1]*kx)*(poly[j][0]*ky);
 }
 return Math.abs(a/2);
}

// 5) Park modu aç/kapat
function toggleParkMode(){
 PARK_MODE=!PARK_MODE;
 const b=$("parkModeBtn");
 b.textContent="🌳 Park Analizi Modu: "+(PARK_MODE?"AÇIK":"KAPALI");
 b.className="btn sm "+(PARK_MODE?"":"blue");
 $("parkModeHint").textContent=PARK_MODE?"Şimdi haritada bir parkın İÇİNE tıkla.":"Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
 bindParkClick();
 if(!PARK_MODE)clearPark();
}

// 6) Harita tıklama olayını bir kez bağla
function bindParkClick(){
 if(PARK_CLICK_BOUND||!map)return;
 PARK_CLICK_BOUND=true;
 map.on("click",async e=>{
  if(!PARK_MODE)return;
  toast("🌳 Park sınırı sorgulanıyor…","info");
  const park=await queryPark(e.latlng.lat,e.latlng.lng);
  if(!park)return toast("Burada park bulunamadı. Bir parkın içine tıkla.","warn");
  drawPark(park);
 });
}

// 7) Park sınırını çiz
function drawPark(park){
 clearPark();
 PARK_POLY=park.poly;
 PARK_LAYER=L.polygon(park.poly,{color:"#2b6cb0",weight:2.5,dashArray:"6,6",fillColor:"#3b82f6",fillOpacity:.10,interactive:false}).addTo(map);
 map.fitBounds(PARK_LAYER.getBounds(),{padding:[30,30]});
 const ha=(park.area/10000).toFixed(2);
 $("parkInfo").style.display="block";
 $("parkInfo").innerHTML=`<b>🌳 ${esc(park.name||"İsimsiz Park")}</b> · Alan: <b>${ha} ha</b> · Sınır: ${park.poly.length} köşe noktası<br><span style="font-size:.8rem;color:var(--mut)">✓ Sınır algılandı. Grid boyutu seçimi ve hücre analizi bir sonraki adımda gelecek.</span>`;
 toast("✓ Park sınırı algılandı: "+ha+" hektar","ok","🌳");
}

// 8) Park katmanını temizle
function clearPark(){
 if(PARK_LAYER&&map){map.removeLayer(PARK_LAYER);PARK_LAYER=null;}
 PARK_POLY=null;
 const pi=$("parkInfo");
 if(pi){pi.style.display="none";pi.innerHTML="";}
}
