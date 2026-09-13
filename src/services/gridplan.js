"use strict";
/* ===== DendroGeo v2 · src/services/gridplan.js =====
Park sınırı algılama (Overpass API) + grid tabanlı ölçüm planlama
v2: multi-ring destek — yol/derenin böldüğü parklar (Dikmen vb.) artık çalışır */

let PARK_POLY=null,PARK_LAYER=null,PARK_MODE=false,PARK_CLICK_BOUND=false;
const GRID_CELLS=[];
let GRID_LAYER=null;

const OVERPASS_URLS=[
 "https://overpass-api.de/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter"
];

// 1) Overpass: tıklanan noktanın etrafındaki yeşil alanı bul
async function queryPark(lat,lon,radius=1200){
 const q=`[out:json][timeout:20];(way["leisure"~"park|garden|nature_reserve|common|recreation_ground|playground|pitch"](around:${radius},${lat},${lon});way["landuse"~"forest|grass|meadow|recreation_ground"](around:${radius},${lat},${lon});relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon}););out geom;`;
 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q));
   if(!res.ok)continue;
   const json=await res.json();
   const cands=[];
   for(const el of (json.elements||[])){
    const rings=extractRings(el);
    if(!rings||!rings.length)continue;
    cands.push({rings,name:(el.tags&&el.tags.name)||null,area:polyArea(rings)});
   }
   if(!cands.length)continue;
   const inside=cands.filter(c=>pointInPark(lat,lon,c.rings));
   const pool=inside.length?inside:cands;
   pool.sort((a,b)=>a.area-b.area);
   return pool[0];
  }catch(e){}
 }
 return null;
}

// 2) OSM elemanından halka(lar) çıkar — kopuk parçalar ayrı halka kalır
function extractRings(el){
 if(el.type==="way"&&el.geometry){
  const r=el.geometry.map(g=>[g.lat,g.lon]);
  return r.length>2?[r]:null;
 }
 if(el.type==="relation"&&el.members){
  const outer=el.members.filter(m=>m.role==="outer"&&m.geometry).map(m=>m.geometry.map(g=>[g.lat,g.lon]));
  if(!outer.length)return null;
  return joinWaysToRings(outer);
 }
 return null;
}

// 3) Uç uca bağlı way'leri birleştir, kopuk parçaları ayrı halka bırak
function joinWaysToRings(ways){
 const rings=[];
 const remaining=ways.slice();
 const eq=(a,b)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;
 while(remaining.length){
  const chain=remaining.shift().slice();
  let merged=true,guard=ways.length*2+10;
  while(merged&&guard-->0){
   merged=false;
   for(let i=0;i<remaining.length;i++){
    const w=remaining[i],head=chain[0],tail=chain[chain.length-1];
    const w0=w[0],w1=w[w.length-1];
    if(eq(tail,w0)){chain.push(...w.slice(1));merged=true;}
    else if(eq(tail,w1)){chain.push(...w.slice().reverse().slice(1));merged=true;}
    else if(eq(head,w1)){chain.unshift(...w.slice(0,-1));merged=true;}
    else if(eq(head,w0)){chain.unshift(...w.slice().reverse().slice(0,-1));merged=true;}
    if(merged){remaining.splice(i,1);break;}
   }
  }
  if(chain.length>2)rings.push(chain);
 }
 return rings;
}

// 4) Nokta tek halka içinde mi (ray casting)
function pointInPolygon(lat,lon,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const yi=ring[i][0],xi=ring[i][1],yj=ring[j][0],xj=ring[j][1];
  if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inside=!inside;
 }
 return inside;
}

// 5) Nokta çok parçalı parkın HERHANGİ bir parçasında mı
function pointInPark(lat,lon,rings){
 return rings.some(r=>pointInPolygon(lat,lon,r));
}

// 6) Tüm parçaların toplam alanı (m²)
function polyArea(rings){
 let total=0;
 for(const ring of rings){
  const lat0=ring[0][0]*Math.PI/180;
  const kx=111320*Math.cos(lat0),ky=110540;
  let a=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   a+=(ring[j][1]*kx)*(ring[i][0]*ky)-(ring[i][1]*kx)*(ring[j][0]*ky);
  }
  total+=Math.abs(a/2);
 }
 return total;
}

// 7) Park modu aç/kapat
function toggleParkMode(){
 PARK_MODE=!PARK_MODE;
 const b=$("parkModeBtn");
 b.textContent="🌳 Park Analizi Modu: "+(PARK_MODE?"AÇIK":"KAPALI");
 b.className="btn sm "+(PARK_MODE?"":"blue");
 $("parkModeHint").textContent=PARK_MODE?"Şimdi haritada bir parkın İÇİNE tıkla.":"Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
 bindParkClick();
 if(!PARK_MODE)clearPark();
}

// 8) Harita tıklama olayını bir kez bağla
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

// 9) Park sınırını çiz (çok parçalı destekli)
function drawPark(park){
 clearPark();
 PARK_POLY=park.rings;
 PARK_LAYER=L.polygon(park.rings,{color:"#2b6cb0",weight:2.5,dashArray:"6,6",fillColor:"#3b82f6",fillOpacity:.10,interactive:false}).addTo(map);
 map.fitBounds(PARK_LAYER.getBounds(),{padding:[30,30]});
 const ha=(park.area/10000).toFixed(2);
 const parca=park.rings.length;
 $("parkInfo").style.display="block";
 $("parkInfo").innerHTML=`<b>🌳 ${esc(park.name||"İsimsiz Park")}</b> · Alan: <b>${ha} ha</b> · Parça: ${parca} · Köşe: ${park.rings.reduce((t,r)=>t+r.length,0)} nokta<br><span style="font-size:.8rem;color:var(--mut)">✓ Sınır algılandı${parca>1?" (yol/derenin böldüğü parçalar dahil)":""}. Grid adımı bir sonraki fazda.</span>`;
 toast("✓ Park sınırı algılandı: "+ha+" hektar"+(parca>1?" ("+parca+" parça)":""),"ok","🌳");
}

// 10) Park katmanını temizle
function clearPark(){
 if(PARK_LAYER&&map){map.removeLayer(PARK_LAYER);PARK_LAYER=null;}
 PARK_POLY=null;
 const pi=$("parkInfo");
 if(pi){pi.style.display="none";pi.innerHTML="";}
}
