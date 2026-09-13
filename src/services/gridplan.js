"use strict";
/* ===== DendroGeo v2 · src/services/gridplan.js =====
Park sınırı algılama (Overpass API) + grid tabanlı ölçüm planlama
v3: multi-ring (yolun böldüğü parklar) + en büyük kapsayıcı varsayılan + grid analizi */

let PARK_POLY=null,PARK_LAYER=null,PARK_MODE=false,PARK_CLICK_BOUND=false,PARK_CANDS=[];
const GRID_CELLS=[];
let GRID_LAYER=null;

const OVERPASS_URLS=[
 "https://overpass-api.de/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter"
];

// 1) Overpass: tıklanan noktanın etrafındaki yeşil alanları bul (büyükten küçüğe)
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
   const pool=(inside.length?inside:cands).slice().sort((a,b)=>b.area-a.area);
   return pool;
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
 if(!PARK_MODE){PARK_CANDS=[];clearPark();}
}

// 8) Harita tıklama olayını bir kez bağla
function bindParkClick(){
 if(PARK_CLICK_BOUND||!map)return;
 PARK_CLICK_BOUND=true;
 map.on("click",async e=>{
  if(!PARK_MODE)return;
  toast("🌳 Park sınırı sorgulanıyor…","info");
  const parks=await queryPark(e.latlng.lat,e.latlng.lng);
  if(!parks||!parks.length)return toast("Burada park bulunamadı. Bir parkın içine tıkla.","warn");
  PARK_CANDS=parks;
  drawPark(parks[0]);
 });
}

// 9) Park sınırını çiz (çok parçalı + alternatif seçici + grid kontrolleri)
function drawPark(park){
 clearPark();clearGrid();
 PARK_POLY=park.rings;
 PARK_LAYER=L.polygon(park.rings,{color:"#2b6cb0",weight:2.5,dashArray:"6,6",fillColor:"#3b82f6",fillOpacity:.10,interactive:false}).addTo(map);
 map.fitBounds(PARK_LAYER.getBounds(),{padding:[30,30]});
 const ha=(park.area/10000).toFixed(2);
 const parca=park.rings.length;
 const alt=PARK_CANDS.length>1
  ?`<div style="margin-top:8px;font-size:.8rem">🔁 Alan seç: <select id="parkAlt" onchange="switchPark(+this.value)">`+
   PARK_CANDS.map((c,i)=>`<option value="${i}"${c===park?" selected":""}>${esc(c.name||"İsimsiz")} · ${(c.area/10000).toFixed(1)} ha</option>`).join("")+
   `</select></div>`:"";
 $("parkInfo").style.display="block";
 $("parkInfo").innerHTML=`<b>🌳 ${esc(park.name||"İsimsiz Park")}</b> · Alan: <b>${ha} ha</b>${parca>1?" · Parça: "+parca:""}${alt}`+
  `<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">`+
  `<label style="font-size:.8rem">Grid:</label>`+
  `<select id="gridSize"><option value="10">10×10 m (yoğun)</option><option value="20" selected>20×20 m (önerilen)</option><option value="50">50×50 m (geniş)</option></select>`+
  `<label style="font-size:.8rem">Yeterli eşik:</label>`+
  `<select id="gridThresh"><option value="1">1+</option><option value="2">2+</option><option value="3" selected>3+</option><option value="5">5+</option></select>`+
  `<button class="btn sm blue" onclick="buildGrid()">🔲 Grid Oluştur</button>`+
  `<button class="btn sm" onclick="clearGrid()">✕ Temizle</button></div>`+
  `<div id="gridSummary" style="margin-top:10px;font-size:.85rem;line-height:1.7"></div>`;
 toast("✓ Park sınırı algılandı: "+ha+" hektar"+(parca>1?" ("+parca+" parça)":""),"ok","🌳");
}

// 10) Park katmanını temizle
function clearPark(){
 if(PARK_LAYER&&map){map.removeLayer(PARK_LAYER);PARK_LAYER=null;}
 PARK_POLY=null;
 const pi=$("parkInfo");
 if(pi){pi.style.display="none";pi.innerHTML="";}
}

// 11) Alternatif alana geç
function switchPark(i){
 const p=PARK_CANDS[i];
 if(p)drawPark(p);
}

// 12) Grid oluştur + renklendir + analiz özeti
async function buildGrid(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç");
 const size=+$("gridSize").value||20;
 const thresh=+$("gridThresh").value||3;
 const est=Math.round(polyArea(PARK_POLY)/(size*size));
 if(est>400)return toast("⚠ ~"+est+" hücre çok yoğun. Daha büyük grid boyutu seç.","warn");
 clearGrid();
 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];if(p[1]>maxLon)maxLon=p[1];
 }));
 const lat0=minLat*Math.PI/180;
 const dLat=size/110540,dLon=size/(111320*Math.cos(lat0));
 const cellMap={};
 GRID_CELLS.length=0;
 for(let rI=0;;rI++){
  const s0=minLat+rI*dLat;if(s0>=maxLat)break;
  for(let cI=0;;cI++){
   const w0=minLon+cI*dLon;if(w0>=maxLon)break;
   const cLat=s0+dLat/2,cLon=w0+dLon/2;
   if(!pointInPark(cLat,cLon,PARK_POLY))continue;
   const cell={lat:cLat,lon:cLon,s0,s1:s0+dLat,w0,w1:w0+dLon,n:0};
   cellMap[rI+"_"+cI]=cell;GRID_CELLS.push(cell);
  }
 }
 const{data}=await sb.from("measurements").select("lat,lon").eq("status","Onaylı")
  .gte("lat",minLat).lte("lat",maxLat).gte("lon",minLon).lte("lon",maxLon).limit(5000);
 (data||[]).forEach(m=>{
  const cell=cellMap[Math.floor((m.lat-minLat)/dLat)+"_"+Math.floor((m.lon-minLon)/dLon)];
  if(cell)cell.n++;
 });
 GRID_LAYER=L.layerGroup().addTo(map);
 let g=0,y=0,r0=0;
 GRID_CELLS.forEach(cell=>{
  const col=cell.n===0?"#e11d48":cell.n<thresh?"#f59e0b":"#16a34a";
  if(cell.n===0)r0++;else if(cell.n<thresh)y++;else g++;
  L.rectangle([[cell.s0,cell.w0],[cell.s1,cell.w1]],{color:col,weight:1.2,fillColor:col,fillOpacity:.32,interactive:false}).addTo(GRID_LAYER);
 });
 const tot=GRID_CELLS.length;
 const pct=v=>tot?Math.round(v/tot*100):0;
 $("gridSummary").innerHTML=
  `<b>📊 Park Analizi</b> · Grid ${size}×${size} m<br>`+
  `Toplam hücre: <b>${tot}</b><br>`+
  `<span style="color:#16a34a">🟢 Yeterli (${thresh}+): ${g} (%${pct(g)})</span> · `+
  `<span style="color:#b45309">🟡 Az: ${y} (%${pct(y)})</span> · `+
  `<span style="color:#e11d48">🔴 Boş: ${r0} (%${pct(r0)})</span><br>`+
  `💡 Öneri: <b>${r0}</b> boş hücreye en az 1'er ölçüm yapın.`;
 toast("✓ Grid hazır: "+tot+" hücre ("+r0+" boş)","ok","🔲");
}

// 13) Grid'i temizle
function clearGrid(){
 if(GRID_LAYER&&map){map.removeLayer(GRID_LAYER);GRID_LAYER=null;}
 GRID_CELLS.length=0;
 const gs=$("gridSummary");if(gs)gs.innerHTML="";
}
