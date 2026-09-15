"use strict";
/* =========================================================
 * DendroGeo v2 · gridplan.js v23 — BİLİMSEL HASSASİYET
 * Geodezik alan · yol genişlikli sert zemin · seyrek olmayan grid
 * ========================================================= */

let PARK_POLY=null,PARK_LAYER=null,PARK_MODE=false,PARK_CLICK_BOUND=false,PARK_CANDS=[];
let WATER_RINGS=[],WATER_LINES=[],WATER_LAYER=null;
let IMP_RINGS=[],IMP_LINES=[],IMP_LAYER=null;
let GRID_BLOCK_LINES=[];
const GRID_CELLS=[];
let GRID_LAYER=null,WP_AUTO_LAYER=null;
const SELECTED_CELLS=new Set();
let LAST_WP_ROWS=[];
let PARK_REF_HA=null;
let LANDCOVER=null;

const WATER_CLEARANCE_M=1;
const IMP_CLEARANCE_M=1;

const OVERPASS_URLS=[
 "https://overpass.private.coffee/api/interpreter",
 "https://overpass.openstreetmap.fr/api/interpreter",
 "https://overpass.osm.ch/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter",
 "https://overpass-api.de/api/interpreter"
];

/* ---------- GEODEZİK ALAN (küresel, %0.1 hassas) ---------- */
function ringGeodesicArea(ring){
 const R=6378137;
 let t=0;
 for(let i=0;i<ring.length;i++){
  const p1=ring[i],p2=ring[(i+1)%ring.length];
  const l1=p1[1]*Math.PI/180,l2=p2[1]*Math.PI/180;
  const f1=p1[0]*Math.PI/180,f2=p2[0]*Math.PI/180;
  t+=(l2-l1)*(2+Math.sin(f1)+Math.sin(f2));
 }
 return t*R*R/2;
}
function polyArea(rings){
 let t=0;
 for(const ring of rings){
  if(!ring||ring.length<3)continue;
  t+=Math.abs(ringGeodesicArea(ring));
 }
 return t;
}

/* ---------- PROJEKSİYON / BBOX ---------- */
function projectPoint(lat,lon,refLat){
 return {x:lon*111320*Math.cos(refLat*Math.PI/180), y:lat*110540};
}
function ringBBox(ring,refLat){
 let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
 for(const p of ring){
  const q=projectPoint(p[0],p[1],refLat);
  if(q.x<a)a=q.x;if(q.y<b)b=q.y;if(q.x>c)c=q.x;if(q.y>d)d=q.y;
 }
 return {minX:a,minY:b,maxX:c,maxY:d};
}
function expandBBox(x,d){return {minX:x.minX-d,minY:x.minY-d,maxX:x.maxX+d,maxY:x.maxY+d};}
function bboxesOverlap(a,b){return !(a.maxX<b.minX||a.minX>b.maxX||a.maxY<b.minY||a.minY>b.maxY);}

/* ---------- NOKTA POLİGON ---------- */
function pointInPolygonXY(x,y,poly){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;
  if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;
 }
 return inside;
}
function pointInPolygon(lat,lon,ring){
 if(!ring||ring.length<3)return false;
 const p=projectPoint(lat,lon,lat);
 return pointInPolygonXY(p.x,p.y,ring.map(q=>projectPoint(q[0],q[1],lat)));
}
function pointInPark(lat,lon,rings){
 if(!rings||!rings.length)return false;
 return rings.some(r=>pointInPolygon(lat,lon,r));
}

/* ---------- SEGMENT ---------- */
function orientation(a,b,c){
 const v=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 if(Math.abs(v)<1e-9)return 0;
 return v>0?1:2;
}
function onSegment(a,b,p){
 return p.x>=Math.min(a.x,b.x)-1e-9&&p.x<=Math.max(a.x,b.x)+1e-9&&
        p.y>=Math.min(a.y,b.y)-1e-9&&p.y<=Math.max(a.y,b.y)+1e-9;
}
function segmentsIntersect(a,b,c,d){
 const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);
 if(o1!==o2&&o3!==o4)return true;
 if(o1===0&&onSegment(a,b,c))return true;
 if(o2===0&&onSegment(a,b,d))return true;
 if(o3===0&&onSegment(c,d,a))return true;
 if(o4===0&&onSegment(c,d,b))return true;
 return false;
}
function rectCorners(r){
 return [{x:r.minX,y:r.minY},{x:r.maxX,y:r.minY},{x:r.maxX,y:r.maxY},{x:r.minX,y:r.maxY}];
}
function segmentIntersectsRect(a,b,rect){
 const cs=rectCorners(rect);
 for(let i=0;i<4;i++)if(segmentsIntersect(a,b,cs[i],cs[(i+1)%4]))return true;
 if(a.x>=rect.minX&&a.x<=rect.maxX&&a.y>=rect.minY&&a.y<=rect.maxY)return true;
 if(b.x>=rect.minX&&b.x<=rect.maxX&&b.y>=rect.minY&&b.y<=rect.maxY)return true;
 return false;
}
function geometryIntersectsRect(points,rect,refLat,bufferM=0){
 if(!points||points.length<2)return false;
 const pts=points.map(p=>projectPoint(p[0],p[1],refLat));
 if(!bboxesOverlap(expandBBox(ringBBox(points,refLat),bufferM),expandBBox(rect,bufferM)))return false;
 const tr=expandBBox(rect,bufferM);
 for(const p of pts)if(p.x>=tr.minX&&p.x<=tr.maxX&&p.y>=tr.minY&&p.y<=tr.maxY)return true;
 for(const c of rectCorners(tr))if(pointInPolygonXY(c.x,c.y,pts))return true;
 for(let i=0;i<pts.length;i++)if(segmentIntersectsRect(pts[i],pts[(i+1)%pts.length],tr))return true;
 return false;
}
function geometryLineIntersectsRect(points,rect,refLat,bufferM=0){
 if(!points||points.length<2)return false;
 if(!bboxesOverlap(expandBBox(ringBBox(points,refLat),bufferM),expandBBox(rect,bufferM)))return false;
 const pts=points.map(p=>projectPoint(p[0],p[1],refLat));
 const tr=expandBBox(rect,bufferM);
 for(let i=0;i<pts.length-1;i++)if(segmentIntersectsRect(pts[i],pts[i+1],tr))return true;
 return false;
}

/* ---------- HÜCRE PARK İÇİNDE Mİ? (GEVŞETİLMİŞ: kenar boşluğu yok) ---------- */
function cellInsidePark(s0,s1,w0,w1){
 const cLat=(s0+s1)/2,cLon=(w0+w1)/2;
 if(!pointInPark(cLat,cLon,PARK_POLY))return false;
 let inCount=0;
 const corners=[[s0,w0],[s0,w1],[s1,w1],[s1,w0]];
 for(const p of corners)if(pointInPark(p[0],p[1],PARK_POLY))inCount++;
 return inCount>=2;
}

/* ---------- HÜCRE GEÇERLİ Mİ? (patikalar kesmez, araç yolları keser) ---------- */
function isCellValid(s0,s1,w0,w1){
 if(!cellInsidePark(s0,s1,w0,w1))return false;
 const cLat=(s0+s1)/2;
 const cellRect=ringBBox([[s0,w0],[s0,w1],[s1,w1],[s1,w0]],cLat);
 for(const w of WATER_RINGS)if(geometryIntersectsRect(w,cellRect,cLat,WATER_CLEARANCE_M))return false;
 for(const l of WATER_LINES)if(geometryLineIntersectsRect(l,cellRect,cLat,WATER_CLEARANCE_M))return false;
 for(const b of IMP_RINGS)if(geometryIntersectsRect(b,cellRect,cLat,IMP_CLEARANCE_M))return false;
 for(const l of GRID_BLOCK_LINES)if(geometryLineIntersectsRect(l,cellRect,cLat,IMP_CLEARANCE_M))return false;
 return true;
}

/* ---------- OVERPASS İKİ AŞAMALI ---------- */
async function queryPark(lat,lon,radius=1200){
 const q1=`[out:json][timeout:25];(`+
  `way["leisure"~"park|garden|nature_reserve|common|recreation_ground|playground|pitch"](around:${radius},${lat},${lon});`+
  `relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+
  `);out geom;`;
 let parkData=null;
 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q1));
   if(!res.ok)continue;
   parkData=await res.json();break;
  }catch(e){}
 }
 if(!parkData||!parkData.elements||!parkData.elements.length)return null;

 const cands=[];
 for(const el of parkData.elements){
  const rings=extractRings(el);
  if(!rings||!rings.length)continue;
  cands.push({rings,name:(el.tags&&el.tags.name)||null,area:polyArea(rings)});
 }
 if(!cands.length)return null;
 const inside=cands.filter(c=>pointInPark(lat,lon,c.rings));
 const sorted=(inside.length?inside:cands).slice().sort((a,b)=>b.area-a.area);
 const park=sorted[0];

 WATER_RINGS=[];WATER_LINES=[];IMP_RINGS=[];IMP_LINES=[];GRID_BLOCK_LINES=[];
 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 park.rings.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];if(p[1]>maxLon)maxLon=p[1];
 }));
 const pad=0.0003;
 const bbox=`${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;
 const q2=`[out:json][timeout:60];(`+
  `way["natural"="water"](${bbox});relation["natural"="water"](${bbox});`+
  `way["building"](${bbox});`+
  `way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|footway|path|cycleway|track|pedestrian"](${bbox});`+
  `);out geom;`;
 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q2));
   if(!res.ok)continue;
   const json=await res.json();
   for(const el of (json.elements||[])){
    if(isWater(el)){collectWaterGeometry(el);continue;}
    if(isImpervious(el)){collectImperviousGeometry(el);continue;}
   }
   break;
  }catch(e){}
 }
 const pb={minLat,maxLat,minLon,maxLon};
 WATER_RINGS=WATER_RINGS.filter(r=>ringTouchesPark(r,park.rings,pb));
 WATER_LINES=WATER_LINES.filter(l=>lineTouchesPark(l,park.rings,pb));
 IMP_RINGS=IMP_RINGS.filter(r=>ringTouchesPark(r,park.rings,pb));
 IMP_LINES=IMP_LINES.filter(l=>lineTouchesPark(l.pts,park.rings,pb));
 GRID_BLOCK_LINES=GRID_BLOCK_LINES.filter(l=>lineTouchesPark(l,park.rings,pb));
 console.log("✓ Park içi → Su:",WATER_RINGS.length,"Bina:",IMP_RINGS.length,"Yol:",IMP_LINES.length);
 return sorted;
}

/* ---------- PARK DIŞI FİLTRE ---------- */
function ringTouchesPark(ring,parkRings,pb){
 let a=90,b=-90,c=180,d=-180;
 for(const p of ring){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}
 if(b<pb.minLat||a>pb.maxLat||d<pb.minLon||c>pb.maxLon)return false;
 for(const p of ring)if(pointInPark(p[0],p[1],parkRings))return true;
 for(const pr of parkRings)for(const p of pr)if(pointInPolygon(p[0],p[1],ring))return true;
 return false;
}
function lineTouchesPark(line,parkRings,pb){
 let a=90,b=-90,c=180,d=-180;
 for(const p of line){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}
 if(b<pb.minLat||a>pb.maxLat||d<pb.minLon||c>pb.maxLon)return false;
 for(const p of line)if(pointInPark(p[0],p[1],parkRings))return true;
 const m=line[Math.floor(line.length/2)];
 return pointInPark(m[0],m[1],parkRings);
}

/* ---------- OSM AYRIŞTIRMA ---------- */
function extractRings(el){
 if(el.type==="way"&&el.geometry){
  const r=el.geometry.map(g=>[g.lat,g.lon]);
  if(r.length>2&&!(Math.abs(r[0][0]-r[r.length-1][0])<1e-9&&Math.abs(r[0][1]-r[r.length-1][1])<1e-9))r.push([r[0][0],r[0][1]]);
  return r.length>2?[r]:null;
 }
 if(el.type==="relation"&&el.members){
  const outer=el.members.filter(m=>m.role==="outer"&&m.geometry).map(m=>m.geometry.map(g=>[g.lat,g.lon]));
  if(!outer.length)return null;
  return joinWaysToRings(outer);
 }
 return null;
}
function isWater(el){
 const t=el.tags||{};
 return t.natural==="water"||t.landuse==="reservoir"||t.landuse==="basin"||t.leisure==="swimming_pool"||!!t.waterway;
}
function isImpervious(el){
 const t=el.tags||{};
 return !!t.building||!!t.highway||t.landuse==="commercial"||t.landuse==="industrial"||t.landuse==="retail"||t.landuse==="construction";
}
function isClosedLine(l){
 return l&&l.length>2&&Math.abs(l[0][0]-l[l.length-1][0])<1e-9&&Math.abs(l[0][1]-l[l.length-1][1])<1e-9;
}
/* Yol sınıfına göre GERÇEK yarı genişlik (m) */
function roadHalfWidth(hw){
 if(/^(motorway|trunk)/.test(hw))return 15;
 if(/^primary/.test(hw))return 12;
 if(/^secondary/.test(hw))return 10;
 if(/^tertiary/.test(hw))return 8;
 if(/^(unclassified|residential)/.test(hw))return 7;
 if(/^service/.test(hw))return 4;
 if(/^living_street/.test(hw))return 5;
 if(/^(footway|path|pedestrian|cycleway|steps)/.test(hw))return 1.5;
 if(/^track/.test(hw))return 3;
 return 6;
}
function collectWaterGeometry(el){
 if(el.type==="relation"){const r=extractRings(el);if(r)WATER_RINGS.push(...r);return;}
 if(!el.geometry)return;
 const line=el.geometry.map(g=>[g.lat,g.lon]);
 const t=el.tags||{};
 if(isClosedLine(line)&&(t.natural==="water"||t.landuse==="reservoir"||t.landuse==="basin"||t.waterway==="riverbank"))WATER_RINGS.push(line);
 else if(line.length>1)WATER_LINES.push(line);
}
function collectImperviousGeometry(el){
 if(el.type==="relation"){const r=extractRings(el);if(r)IMP_RINGS.push(...r);return;}
 if(!el.geometry)return;
 const line=el.geometry.map(g=>[g.lat,g.lon]);
 const t=el.tags||{};
 if(t.building){
  if(isClosedLine(line))IMP_RINGS.push(line);
  else IMP_LINES.push({pts:line,w:0});
  return;
 }
 if(t.highway){
  IMP_LINES.push({pts:line,w:roadHalfWidth(t.highway)});
  if(!/^(footway|path|cycleway|steps|pedestrian|track)/.test(t.highway))GRID_BLOCK_LINES.push(line);
  return;
 }
 if(t.landuse){
  if(isClosedLine(line))IMP_RINGS.push(line);
  else IMP_LINES.push({pts:line,w:0});
  return;
 }
 IMP_LINES.push({pts:line,w:0});
}
function joinWaysToRings(ways){
 const rings=[],rem=ways.slice();
 const eq=(a,b)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;
 while(rem.length){
  const ch=rem.shift().slice();let m=true,g=ways.length*2+10;
  while(m&&g-->0){m=false;for(let i=0;i<rem.length;i++){
   const w=rem[i],h=ch[0],t=ch[ch.length-1];
   if(eq(t,w[0])){ch.push(...w.slice(1));m=true;}
   else if(eq(t,w[w.length-1])){ch.push(...w.slice().reverse().slice(1));m=true;}
   else if(eq(h,w[w.length-1])){ch.unshift(...w.slice(0,-1));m=true;}
   else if(eq(h,w[0])){ch.unshift(...w.slice().reverse().slice(0,-1));m=true;}
   if(m){rem.splice(i,1);break;}
  }}
   if(ch.length>2){
   if(!(Math.abs(ch[0][0]-ch[ch.length-1][0])<1e-9&&Math.abs(ch[0][1]-ch[ch.length-1][1])<1e-9))ch.push([ch[0][0],ch[0][1]]);
   rings.push(ch);
  }
 }
 return rings;
}

/* ---------- ESKİ API ---------- */
function pointInWater(lat,lon){return WATER_RINGS.some(r=>pointInPolygon(lat,lon,r));}
function nearWater(lat,lon){
 const dLat=WATER_CLEARANCE_M/110540,dLon=WATER_CLEARANCE_M/(111320*Math.max(.1,Math.cos(lat*Math.PI/180)));
 const rect=ringBBox([[lat-dLat,lon-dLon],[lat-dLat,lon+dLon],[lat+dLat,lon+dLon],[lat+dLat,lon-dLon]],lat);
 return WATER_RINGS.some(r=>geometryIntersectsRect(r,rect,lat,0))||WATER_LINES.some(l=>geometryLineIntersectsRect(l.pts,rect,lat,0));
}
function nearImpervious(lat,lon){
 const dLat=IMP_CLEARANCE_M/110540,dLon=IMP_CLEARANCE_M/(111320*Math.max(.1,Math.cos(lat*Math.PI/180)));
 const rect=ringBBox([[lat-dLat,lon-dLon],[lat-dLat,lon+dLon],[lat+dLat,lon+dLon],[lat+dLat,lon-dLon]],lat);
 return IMP_RINGS.some(r=>geometryIntersectsRect(r,rect,lat,0))||IMP_LINES.some(l=>geometryLineIntersectsRect(l.pts,rect,lat,0));
}
function isValidSpot(lat,lon){return !pointInWater(lat,lon)&&!nearWater(lat,lon)&&!nearImpervious(lat,lon);}

/* ---------- PARK MODU ---------- */
function toggleParkMode(){
 PARK_MODE=!PARK_MODE;
 const b=$("parkModeBtn");
 b.textContent="🌳 Park Analizi Modu: "+(PARK_MODE?"AÇIK":"KAPALI");
 b.className="btn sm "+(PARK_MODE?"":"blue");
 $("parkModeHint").textContent=PARK_MODE?"Şimdi haritada bir parkın İÇİNE tıkla.":"Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
 bindParkClick();
 if(!PARK_MODE){PARK_CANDS=[];clearPark();}
}
function bindParkClick(){
 if(PARK_CLICK_BOUND||!map)return;
 PARK_CLICK_BOUND=true;
 map.on("click",async e=>{
  if(!PARK_MODE)return;
  toast("🌳 Park sınırı sorgulanıyor…","info");
  const parks=await queryPark(e.latlng.lat,e.latlng.lng);
  if(!parks||!parks.length)return toast("Park bulunamadı veya Overpass yoğun. 10 sn sonra tekrar dene.","warn");
  PARK_CANDS=parks;
  drawPark(parks[0]);
 });
}

/* ---------- PARK ÇİZ (YENİ ARAYÜZ, eşik YOK) ---------- */
function drawPark(park){
 clearPark();clearGrid();
 PARK_POLY=park.rings;
 PARK_LAYER=L.polygon(park.rings,{color:"#2b6cb0",weight:2.5,dashArray:"6,6",fillColor:"#3b82f6",fillOpacity:.10,interactive:false}).addTo(map);
 if(WATER_RINGS.length){
  WATER_LAYER=L.layerGroup().addTo(map);
  WATER_RINGS.forEach(r=>L.polygon(r,{color:"#2563eb",weight:1,fillColor:"#60a5fa",fillOpacity:.4,interactive:false}).addTo(WATER_LAYER));
 }
 if(WATER_LINES.length){
  if(!WATER_LAYER)WATER_LAYER=L.layerGroup().addTo(map);
  WATER_LINES.forEach(l=>L.polyline(l,{color:"#2563eb",weight:2,opacity:.5,interactive:false}).addTo(WATER_LAYER));
 }
 if(IMP_RINGS.length||IMP_LINES.length){
  IMP_LAYER=L.layerGroup().addTo(map);
  IMP_RINGS.forEach(r=>L.polygon(r,{color:"#dc2626",weight:.8,fillColor:"#ef4444",fillOpacity:.22,interactive:false}).addTo(IMP_LAYER));
  IMP_LINES.forEach(l=>L.polyline(l.pts,{color:"#ef4444",weight:2.5,opacity:.35,interactive:false}).addTo(IMP_LAYER));
 }
 map.fitBounds(PARK_LAYER.getBounds(),{padding:[30,30]});

 const haTotal=(park.area/10000).toFixed(1);
 const alt=PARK_CANDS.length>1?
  `<select id="parkAlt" onchange="switchPark(+this.value)" style="font-size:.8rem;padding:4px 8px;border-radius:6px;border:1px solid var(--line)">`+
  PARK_CANDS.map((c,i)=>`<option value="${i}"${c===park?" selected":""}>${esc(c.name||"Alan "+(i+1))} · ${(c.area/10000).toFixed(1)} ha</option>`).join("")+
  `</select>`:"";

 $("parkInfo").style.display="block";
 $("parkInfo").innerHTML=
  `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">`+
   `<b style="font-size:1.08rem">🌳 ${esc(park.name||"İsimsiz Park")}</b>`+
      `<span style="background:#14532d;color:#fff;font-size:.78rem;padding:3px 12px;border-radius:999px">Toplam: ${haTotal} ha</span>`+
   `<span id="refBadge" style="font-size:.75rem;color:var(--mut)"></span>`+
   alt+
  `</div>`+
  `<div style="font-size:.72rem;color:var(--mut);margin-top:4px">Alan hesabı: geodezik (küresel) formül · tüm istatistikler yalnızca park içi</div>`+
  `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:12px">`+
   `<div style="border:1px solid var(--line);border-radius:10px;padding:10px">`+
    `<div style="font-size:.7rem;letter-spacing:.08em;color:var(--mut);margin-bottom:8px">1 · GRID KURULUMU</div>`+
    `<label style="font-size:.78rem">Proje<select id="gridProject" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line);margin-top:2px">`+
    (typeof PROJ_LIST!=="undefined"&&PROJ_LIST.length?PROJ_LIST.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join(""):`<option value="0">Önce proje oluştur</option>`)+
    `</select></label>`+
    `<label style="font-size:.78rem;display:block;margin-top:6px">Grid boyutu<select id="gridSize" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line);margin-top:2px">`+
     `<option value="10">10×10 m</option><option value="20" selected>20×20 m</option><option value="50">50×50 m</option>`+
    `</select></label>`+
    `<label style="font-size:.78rem;display:block;margin-top:6px">Referans alan (ha, opsiyonel)<input id="refHa" type="number" step="0.1" placeholder="örn. resmi 50.8" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line);margin-top:2px" onchange="setRefHa(this.value)"></label>`+
    `<button class="btn sm blue" style="width:100%;margin-top:8px" onclick="buildGrid()">🔲 Grid Oluştur</button>`+
   `</div>`+
   `<div style="border:1px solid var(--line);border-radius:10px;padding:10px">`+
    `<div style="font-size:.7rem;letter-spacing:.08em;color:var(--mut);margin-bottom:8px">2 · ANALİZ & RAPOR</div>`+
    `<button class="btn sm" style="width:100%" onclick="runLandCoverAnalysis()">🌿 Yüzey Örtüsü Analizi (park içi)</button>`+
    `<label style="font-size:.78rem;display:block;margin-top:8px">PNG arka plan<select id="pngBg" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line);margin-top:2px">`+
     `<option value="vector">Vektör (temiz beyaz)</option><option value="osm">OSM sokak</option>`+
     `<option value="sat">Uydu görüntüsü</option><option value="topo">Topoğrafik</option>`+
    `</select></label>`+
    `<div style="font-size:.75rem;color:var(--mut);margin:6px 0 4px">PNG içeriği:</div>`+
    `<label style="font-size:.78rem;display:block"><input type="checkbox" id="chkPngGrid" checked> Grid</label>`+
    `<label style="font-size:.78rem;display:block"><input type="checkbox" id="chkPngWp" checked> Waypoint</label>`+
    `<label style="font-size:.78rem;display:block"><input type="checkbox" id="chkPngCover" checked> Su / sert zemin</label>`+
    `<button class="btn sm ghost" style="width:100%;margin-top:8px" onclick="downloadParkImage()">🖼️ Rapor PNG İndir</button>`+
   `</div>`+
   `<div style="border:1px solid var(--line);border-radius:10px;padding:10px">`+
    `<div style="font-size:.7rem;letter-spacing:.08em;color:var(--mut);margin-bottom:8px">3 · KATMAN & TEMİZLİK</div>`+
    `<div style="display:grid;gap:6px">`+
     `<button class="btn sm" id="gridVisBtn" onclick="toggleGridVis()">🔲 Grid: GÖRÜNÜR</button>`+
     `<button class="btn sm" id="wpVisBtn" onclick="toggleWpVis()">📍 Waypoint: GÖRÜNÜR</button>`+
     `<button class="btn sm red" onclick="clearGrid()">✕ Grid'i Temizle</button>`+
    `</div>`+
   `</div>`+
  `</div>`+
  `<div id="landCoverReport" style="margin-top:10px;font-size:.82rem;line-height:1.6"></div>`+
  `<div id="gridSummary" style="margin-top:10px;font-size:.85rem;line-height:1.7"></div>`;
 renderRefBadge();
 toast("✓ Park algılandı: "+haTotal+" ha (toplam)","ok","🌳");
}
function clearPark(){
 if(PARK_LAYER&&map){map.removeLayer(PARK_LAYER);PARK_LAYER=null;}
 if(WATER_LAYER&&map){map.removeLayer(WATER_LAYER);WATER_LAYER=null;}
 if(IMP_LAYER&&map){map.removeLayer(IMP_LAYER);IMP_LAYER=null;}
 PARK_POLY=null;
}
function switchPark(i){const p=PARK_CANDS[i];if(p)drawPark(p);}

/* ---------- GRID ---------- */
async function buildGrid(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç");
 const size=+$("gridSize").value||20;
 const est=Math.round(polyArea(PARK_POLY)/(size*size));
 if(est>3000)return toast("⚠ ~"+est+" hücre çok yoğun. 50×50 m seç.","err");
 if(est>800&&!confirm(`⚠ ~${est} hücre oluşturulacak.\nDevam?`))return;
 clearGrid();
 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];if(p[1]>maxLon)maxLon=p[1];
 }));
 const lat0=((minLat+maxLat)/2)*Math.PI/180;
 const dLat=size/110540,dLon=size/(111320*Math.max(.1,Math.cos(lat0)));
 const cellMap={};GRID_CELLS.length=0;
 for(let rI=0;;rI++){
  const s0=minLat+rI*dLat,s1=s0+dLat;
  if(s0>=maxLat)break;
  for(let cI=0;;cI++){
   const w0=minLon+cI*dLon,w1=w0+dLon;
   if(w0>=maxLon)break;
   if(!isCellValid(s0,s1,w0,w1))continue;
   const cell={lat:(s0+s1)/2,lon:(w0+w1)/2,s0,s1,w0,w1,n:0,id:rI+"_"+cI};
   cellMap[cell.id]=cell;GRID_CELLS.push(cell);
  }
 }
 const{data}=await sb.from("measurements").select("lat,lon").eq("status","Onaylı")
  .gte("lat",minLat).lte("lat",maxLat).gte("lon",minLon).lte("lon",maxLon).limit(5000);
 (data||[]).forEach(m=>{
  const cell=cellMap[Math.floor((m.lat-minLat)/dLat)+"_"+Math.floor((m.lon-minLon)/dLon)];
  if(cell)cell.n++;
 });
 SELECTED_CELLS.clear();
 drawGridLayer();
 toast("✓ Grid hazır: "+GRID_CELLS.length+" hücre","ok","🔲");
}
function drawGridLayer(){
 if(GRID_LAYER&&map)map.removeLayer(GRID_LAYER);
 GRID_LAYER=L.layerGroup().addTo(map);
 let g=0,r0=0;
 GRID_CELLS.forEach(cell=>{
  const col=cell.n===0?"#e11d48":"#16a34a";
  if(cell.n===0)r0++;else g++;
  const isSel=SELECTED_CELLS.has(cell.id);
  const rect=L.rectangle([[cell.s0,cell.w0],[cell.s1,cell.w1]],{
   color:isSel?"#1d4ed8":col,weight:isSel?3:1.2,
   fillColor:isSel?"#3b82f6":col,fillOpacity:isSel?.55:.32,interactive:true
  }).addTo(GRID_LAYER);
  rect._cellId=cell.id;
  rect.on("click",e=>{L.DomEvent.stopPropagation(e);toggleCellSelection(cell.id,rect);});
  rect.bindTooltip(`Hücre ${cell.id} · ${cell.n} ölçüm · Tıkla: seç/kaldır`,{sticky:true});
 });
 updateGridSummary(g,r0);
}
function updateGridSummary(g,r0){
 const tot=GRID_CELLS.length,pct=v=>tot?Math.round(v/tot*100):0;
 const selCount=SELECTED_CELLS.size;
 $("gridSummary").innerHTML=
  `<b>📊 Park Analizi</b> · Grid ${$("gridSize")?.value||20}×${$("gridSize")?.value||20} m<br>`+
  `Toplam: <b>${tot}</b> · 🟢 Ölçülmüş: ${g} (%${pct(g)}) · 🔴 Boş: ${r0} (%${pct(r0)})<br>`+
  (selCount>0?`<b style="color:#1d4ed8">🔵 Seçili: ${selCount}</b><br>`:"")+
  `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">`+
  (r0>0?`<button class="btn sm blue" onclick="createWaypointsFromGrid('auto')">📍 Otomatik (${r0} boş)</button>`:"")+
  (selCount>0?`<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid('manual')">📍 Seçili (${selCount})</button>`:"")+
  (selCount>0?`<button class="btn sm ghost" onclick="clearCellSelection()">✕ Seçimi Temizle</button>`:"")+
  `<button class="btn sm ghost" onclick="downloadGridGeoJSON()">📥 Grid GeoJSON</button>`+
  `<button class="btn sm ghost" onclick="downloadWaypointsCSV()">📥 Waypoint CSV</button>`+
  `</div>`;
}
function toggleCellSelection(cellId,rect){
 if(SELECTED_CELLS.has(cellId)){
  SELECTED_CELLS.delete(cellId);
  const cell=GRID_CELLS.find(c=>c.id===cellId);
  if(cell)rect.setStyle({color:cell.n===0?"#e11d48":"#16a34a",weight:1.2,fillColor:cell.n===0?"#e11d48":"#16a34a",fillOpacity:.32});
 }else{
  SELECTED_CELLS.add(cellId);
  rect.setStyle({color:"#1d4ed8",weight:3,fillColor:"#3b82f6",fillOpacity:.55});
 }
 let g=0,r0=0;
 GRID_CELLS.forEach(c=>{if(c.n===0)r0++;else g++;});
 updateGridSummary(g,r0);
}
function clearCellSelection(){
 SELECTED_CELLS.clear();
 if(GRID_LAYER){
  GRID_LAYER.eachLayer(l=>{
   if(l.setStyle&&l._cellId){
    const cell=GRID_CELLS.find(c=>c.id===l._cellId);
    if(cell)l.setStyle({color:cell.n===0?"#e11d48":"#16a34a",weight:1.2,fillColor:cell.n===0?"#e11d48":"#16a34a",fillOpacity:.32});
   }
  });
 }
 let g=0,r0=0;
 GRID_CELLS.forEach(c=>{if(c.n===0)r0++;else g++;});
 updateGridSummary(g,r0);
}
function clearGrid(){
 if(GRID_LAYER&&map){map.removeLayer(GRID_LAYER);GRID_LAYER=null;}
 if(WP_AUTO_LAYER&&map){map.removeLayer(WP_AUTO_LAYER);WP_AUTO_LAYER=null;}
 GRID_CELLS.length=0;SELECTED_CELLS.clear();
 const gs=$("gridSummary");if(gs)gs.innerHTML="";
}
function toggleGridVis(){
 if(!GRID_LAYER)return;
 if(map.hasLayer(GRID_LAYER)){map.removeLayer(GRID_LAYER);$("gridVisBtn").textContent="🔲 Grid: GİZLİ";}
 else{map.addLayer(GRID_LAYER);$("gridVisBtn").textContent="🔲 Grid: GÖRÜNÜR";}
}
function toggleWpVis(){
 if(!WP_AUTO_LAYER)return;
 if(map.hasLayer(WP_AUTO_LAYER)){map.removeLayer(WP_AUTO_LAYER);$("wpVisBtn").textContent="📍 Waypoint: GİZLİ";}
 else{map.addLayer(WP_AUTO_LAYER);$("wpVisBtn").textContent="📍 Waypoint: GÖRÜNÜR";}
}

/* ---------- WAYPOINT ---------- */
async function createWaypointsFromGrid(mode){
 if(!GRID_CELLS.length)return toast("Önce grid oluştur","warn");
 const pid=+$("gridProject").value||0;
 if(!pid)return toast("Önce proje seç veya oluştur","warn");
 let targetCells=[];
 if(mode==="manual"){
  if(!SELECTED_CELLS.size)return toast("Önce hücre seçin","warn");
  targetCells=GRID_CELLS.filter(c=>SELECTED_CELLS.has(c.id));
 }else{
  targetCells=GRID_CELLS.filter(c=>c.n===0);
 }
 if(!targetCells.length)return toast("Uygun hücre yok","warn");
 if(targetCells.length>500&&!confirm(targetCells.length+" waypoint oluşturulacak.\nDevam?"))return;
 const{data:mx}=await sb.from("waypoints").select("wp_id").eq("project_id",pid).order("wp_id",{ascending:false}).limit(1);
 let next=(mx&&mx.length?mx[0].wp_id:0)+1;
 const first=next;
 const rows=targetCells.map(c=>({owner:USER.id,project_id:pid,wp_id:next++,lat:+c.lat.toFixed(6),lon:+c.lon.toFixed(6),visited:false}));
 LAST_WP_ROWS=rows;
 const{error}=await sb.from("waypoints").insert(rows);
 if(error)return toast("Hata: "+error.message,"err");
 if(WP_AUTO_LAYER&&map)map.removeLayer(WP_AUTO_LAYER);
 WP_AUTO_LAYER=L.layerGroup().addTo(map);
 rows.forEach(r=>L.circleMarker([r.lat,r.lon],{radius:5,color:"#fff",weight:1.5,fillColor:"#e11d48",fillOpacity:.95,interactive:false}).addTo(WP_AUTO_LAYER));
 $("nProject").value=String(pid);
 loadWaypoints();
 toast("✓ "+rows.length+" waypoint oluşturuldu (P"+first+"–P"+(next-1)+")","ok","📍");
 clearCellSelection();
}

/* ---------- ÇIKTILAR ---------- */
function lineLengthM(l){
 let len=0;
 for(let i=1;i<l.length;i++){
  const dy=(l[i][0]-l[i-1][0])*110540;
  const dx=(l[i][1]-l[i-1][1])*111320*Math.cos(l[i][0]*Math.PI/180);
  len+=Math.sqrt(dx*dx+dy*dy);
 }
 return len;
}
function downloadBlob(name,mime,text){
 const b=new Blob([text],{type:mime});
 const u=URL.createObjectURL(b);
 const a=document.createElement("a");a.href=u;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function downloadGridGeoJSON(){
 if(!GRID_CELLS.length)return toast("Önce grid oluştur","warn");
 const fc={type:"FeatureCollection",features:GRID_CELLS.map(c=>({
  type:"Feature",
  properties:{id:c.id,olcum:c.n,durum:c.n===0?"bos":"olculmus"},
  geometry:{type:"Polygon",coordinates:[[[c.w0,c.s0],[c.w1,c.s0],[c.w1,c.s1],[c.w0,c.s1],[c.w0,c.s0]]]}
 }))};
 downloadBlob("dendrogeo_grid.geojson","application/geo+json",JSON.stringify(fc,null,2));
 toast("✓ Grid GeoJSON indirildi","ok","📥");
}
function downloadWaypointsCSV(){
 const rows=LAST_WP_ROWS.length?LAST_WP_ROWS:WP;
 if(!rows||!rows.length)return toast("İndirilecek waypoint yok","warn");
 let csv="wp_id,lat,lon,visited\n";
 rows.forEach(r=>{csv+=r.wp_id+","+r.lat+","+r.lon+","+(r.visited?1:0)+"\n";});
 downloadBlob("dendrogeo_waypoints.csv","text/csv",csv);
 toast("✓ "+rows.length+" waypoint CSV indirildi","ok","📥");
}

function densifyLine(pts, stepM){
 const out=[];
 for(let i=0;i<pts.length-1;i++){
  const a=pts[i], b=pts[i+1];
  const dy=(b[0]-a[0])*110540;
  const dx=(b[1]-a[1])*111320*Math.cos(a[0]*Math.PI/180);
  const len=Math.sqrt(dx*dx+dy*dy);
  const n=Math.max(1, Math.ceil(len/stepM));
  for(let k=0;k<n;k++) out.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]);
 }
 out.push(pts[pts.length-1]);
 return out;
}
/* ---------- ARAZİ ÖRTÜSÜ (5m örneklem, yol genişlikli) ---------- */
function buildNodeIndexW(lines){
 const idx={},cs=0.0004;
 lines.forEach(l=>l.pts.forEach(p=>{
  const k=Math.floor(p[0]/cs)+"_"+Math.floor(p[1]/cs);
  (idx[k]=idx[k]||[]).push([p[0],p[1],l.w]);
 }));
 return {idx,cs};
}
function nearLineW(index,lat,lon){
 const cs=index.cs,i0=Math.floor(lat/cs),j0=Math.floor(lon/cs);
 for(let i=i0-1;i<=i0+1;i++)for(let j=j0-1;j<=j0+1;j++){
  const arr=index.idx[i+"_"+j];
  if(!arr)continue;
  for(const q of arr){
   const dy=(q[0]-lat)*110540,dx=(q[1]-lon)*111320*Math.cos(lat*Math.PI/180);
   if(dx*dx+dy*dy<q[2]*q[2])return true;
  }
 }
 return false;
}

function refreshImpLayer(){
 if(IMP_LAYER&&map)map.removeLayer(IMP_LAYER);
 IMP_LAYER=L.layerGroup().addTo(map);
 IMP_RINGS.forEach(r=>L.polygon(r,{color:"#dc2626",weight:.8,fillColor:"#ef4444",fillOpacity:.22,interactive:false}).addTo(IMP_LAYER));
 IMP_LINES.forEach(l=>L.polyline(l.pts,{color:"#ef4444",weight:2.5,opacity:.35,interactive:false}).addTo(IMP_LAYER));
}

/* Yüzey örtüsü: TEK SEFERLİK özel sorgu · YALNIZCA park içi
   SERT = bina + tüm yollar + otopark + kaplı yüzey
   YEŞİL = kalan her şey (çim, toprak, ağaçlık)
   SU = mevcut su katmanı */
async function runLandCoverAnalysis(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç");
 const rep=$("landCoverReport");
 if(rep)rep.innerHTML="⏳ Park içi yüzey sorgusu (tek seferlik)…";
 toast("🌿 Park sınırının İÇİ taranıyor…","info");

 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];if(p[1]>maxLon)maxLon=p[1];
 }));
 const pad=0.0002;
 const bbox=`${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;

 const q=`[out:json][timeout:60];(`+
  `way["building"](${bbox});relation["building"](${bbox});`+
  `way["highway"](${bbox});`+
  `way["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
  `way["surface"~"paved|asphalt|concrete|paving_stones|sett"](${bbox});`+
  `way["landuse"~"commercial|industrial|retail|construction"](${bbox});`+
  `);out geom;`;

 let hardRings=[],hardLines=[];
 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q));
   if(!res.ok)continue;
   const json=await res.json();
   for(const el of (json.elements||[])){
    const t=el.tags||{};
    if(el.type==="relation"){
     const rr=extractRings(el);
     if(rr)rr.forEach(r=>hardRings.push(r));
     continue;
    }
    if(!el.geometry)continue;
    const pts=el.geometry.map(g=>[g.lat,g.lon]);
    if(pts.length<2)continue;
    if(isClosedLine(pts)){hardRings.push(pts);continue;}
    let w=0;
    if(t.highway)w=roadHalfWidth(t.highway);
    else if(t.surface)w=3;
    else w=2;
    hardLines.push({pts,w});
   }
   break;
  }catch(e){}
 }

 const pb={minLat,maxLat,minLon,maxLon};
 hardRings=hardRings.filter(r=>ringTouchesPark(r,PARK_POLY,pb));
 hardLines=hardLines.filter(l=>lineTouchesPark(l.pts,PARK_POLY,pb));

 /* Küresel katmanları da zenginleştir (grid + PNG bundan faydalanır) */
 IMP_RINGS=hardRings.slice();
 IMP_LINES=hardLines.map(l=>({pts:l.pts,w:l.w}));
 GRID_BLOCK_LINES=hardLines.filter(l=>l.w>=4).map(l=>l.pts);
 refreshImpLayer();

 /* 5m örneklem — yalnızca park içi */
 const denseLines=hardLines.map(l=>({pts:densifyLine(l.pts,4),w:l.w}));
 const lineIdx=buildNodeIndexW(denseLines);
 const stepLat=5/110540;
 const stepLon=5/(111320*Math.cos(((minLat+maxLat)/2)*Math.PI/180));
 let nPark=0,nWater=0,nImp=0,nGreen=0;
 for(let la=minLat;la<=maxLat;la+=stepLat){
  for(let lo=minLon;lo<=maxLon;lo+=stepLon){
   if(!pointInPark(la,lo,PARK_POLY))continue;
   nPark++;
   if(pointInWater(la,lo)){nWater++;continue;}
   let imp=false;
   for(const r of IMP_RINGS){if(pointInPolygon(la,lo,r)){imp=true;break;}}
   if(!imp&&nearLineW(lineIdx,la,lo))imp=true;
   if(imp){nImp++;continue;}
   nGreen++;
  }
 }

 /* Geometrik çapraz kontrol */
 let cross=0;
 IMP_RINGS.forEach(r=>{
  let vin=0;for(const p of r)if(pointInPark(p[0],p[1],PARK_POLY))vin++;
  cross+=polyArea([r])*(r.length?vin/r.length:0);
 });
 IMP_LINES.forEach(l=>{
  let vin=0;for(const p of l.pts)if(pointInPark(p[0],p[1],PARK_POLY))vin++;
  cross+=lineLengthM(l.pts)*(l.w*2)*(l.pts.length?vin/l.pts.length:0);
 });

  const totalHa=polyArea(PARK_POLY)/10000;
 const ha=v=>((v/Math.max(1,nPark))*totalHa).toFixed(1);
 const pct=v=>nPark?Math.round(v/nPark*100):0;
 LANDCOVER={green:+ha(nGreen),hard:+ha(nImp),water:+ha(nWater),total:+totalHa.toFixed(1)};
 const row=(color,label,haV,pv)=>
  `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">`+
  `<span style="width:12px;height:12px;border-radius:3px;background:${color};flex:none"></span>`+
  `<span style="width:52px;font-size:.8rem">${label}</span>`+
  `<div style="flex:1;height:10px;background:var(--line);border-radius:5px;overflow:hidden"><div style="height:100%;width:${pv}%;background:${color};transition:width .6s"></div></div>`+
  `<b style="font-size:.8rem;width:74px;text-align:right">${haV} ha</b>`+
  `<span style="font-size:.72rem;color:var(--mut);width:38px">%${pv}</span></div>`;

 if(rep)rep.innerHTML=
  `<b>🌿 Yüzey Örtüsü Analizi</b> <span style="color:var(--mut);font-size:.72rem">(5m örneklem · yalnızca park içi · tek sorgu)</span>`+
  row("#16a34a","Yeşil",ha(nGreen),pct(nGreen))+
  row("#ef4444","Sert",ha(nImp),pct(nImp))+
  row("#3b82f6","Su",ha(nWater),pct(nWater))+
  `<div style="font-size:.72rem;color:var(--mut);margin-top:6px">`+
  `Toplam: <b>${totalHa.toFixed(1)} ha</b> (geodezik) · Yeşil+Sert+Su = Toplam (tutarlı)<br>`+
  `Çapraz kontrol: geometrik sert ≈ ${(cross/10000).toFixed(1)} ha · örneklem-geometri uyumu %${Math.max(0,Math.round(100-Math.abs(+ha(nImp)-cross/10000)/Math.max(cross/10000,0.1)*100))}</div>`;
 toast("✓ Yüzey örtüsü analizi tamam","ok","🌿");
}

/* ---------- PNG RAPOR (harita katmanlı) ---------- */
async function drawTiles(ctx,bg,minLat,minLon,maxLat,maxLon,scale,ox,oy){
 const urls={
  osm:(x,y,z)=>`https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  sat:(x,y,z)=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  topo:(x,y,z)=>`https://a.tile.opentopomap.org/${z}/${x}/${y}.png`
 };
 const zoom=Math.min(19,Math.max(3,Math.round(Math.log2(360*scale/256))));
 const n=Math.pow(2,zoom);
 const x0=Math.floor((minLon+180)/360*n),x1=Math.floor((maxLon+180)/360*n);
 const yFor=lat=>{const r=lat*Math.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n);};
 const y0=yFor(maxLat),y1=yFor(minLat);
 const lonOf=x=>x/n*360-180;
 const latOf=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
 const imgs=[];
 for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
  const img=new Image();img.crossOrigin="anonymous";img.src=urls[bg](x,y,zoom);
  imgs.push({img,x,y});
 }
 try{
  await Promise.all(imgs.map(o=>o.img.decode?o.img.decode():new Promise((res,rej)=>{o.img.onload=res;o.img.onerror=rej;})));
 }catch(e){return false;}
 for(const o of imgs){
  const p0=[ox+(lonOf(o.x)-minLon)*scale, oy+(maxLat-latOf(o.y))*scale];
  const p1=[ox+(lonOf(o.x+1)-minLon)*scale, oy+(maxLat-latOf(o.y+1))*scale];
  ctx.drawImage(o.img,p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]);
 }
 try{ctx.getImageData(0,0,1,1);}catch(e){return false;}
 return true;
}
async function downloadParkImage(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç","warn");
 const bg=$("pngBg")?$("pngBg").value:"vector";
 const incGrid=($("chkPngGrid")?$("chkPngGrid").checked:true)&&GRID_CELLS.length>0;
 const incWp=($("chkPngWp")?$("chkPngWp").checked:true);
 const incCover=($("chkPngCover")?$("chkPngCover").checked:true);
 const wpRows=(LAST_WP_ROWS.length?LAST_WP_ROWS:WP).filter(w=>pointInPark(w.lat,w.lon,PARK_POLY));
 const showWp=incWp&&wpRows.length>0;

 const W=1600,H=1200;
 const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext("2d");
 const mapC=document.createElement("canvas");mapC.width=W;mapC.height=H;
 const mctx=mapC.getContext("2d");
 mctx.fillStyle="#ffffff";mctx.fillRect(0,0,W,H);

 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];if(p[1]>maxLon)maxLon=p[1];
 }));
 const pad=0.0004;minLat-=pad;maxLat+=pad;minLon-=pad;maxLon+=pad;
 const dLat=maxLat-minLat,dLon=maxLon-minLon;
 const scale=Math.min((W-140)/dLon,(H-200)/dLat);
 const ox=(W-dLon*scale)/2,oy=(H-dLat*scale)/2+30;
 const toXY=(lat,lon)=>[ox+(lon-minLon)*scale, oy+(maxLat-lat)*scale];

 if(bg!=="vector"){
  const ok=await drawTiles(mctx,bg,minLat,minLon,maxLat,maxLon,scale,ox,oy);
  if(!ok){mctx.fillStyle="#ffffff";mctx.fillRect(0,0,W,H);toast("⚠ Tile yüklenemedi → vektör","warn");}
 }
 if(incCover){
  IMP_RINGS.forEach(r=>{
   if(!r||r.length<3)return;
mctx.fillStyle="#ef444444";mctx.strokeStyle="#dc2626";mctx.lineWidth=1;
   mctx.beginPath();
   r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?mctx.moveTo(xy[0],xy[1]):mctx.lineTo(xy[0],xy[1]);});
   mctx.closePath();mctx.fill();mctx.stroke();
  });
  IMP_LINES.forEach(l=>{
  mctx.strokeStyle="#ef444466";mctx.lineWidth=Math.max(1.5,l.w*scale/55660);
   mctx.beginPath();
   l.pts.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?mctx.moveTo(xy[0],xy[1]):mctx.lineTo(xy[0],xy[1]);});
   mctx.stroke();
  });
  WATER_RINGS.forEach(r=>{
   if(!r||r.length<3)return;
   mctx.fillStyle="#3b82f699";mctx.strokeStyle="#1d4ed8";mctx.lineWidth=1.5;
   mctx.beginPath();
   r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?mctx.moveTo(xy[0],xy[1]):mctx.lineTo(xy[0],xy[1]);});
   mctx.closePath();mctx.fill();mctx.stroke();
  });
 }
 if(incGrid){
  GRID_CELLS.forEach(c=>{
   const a=toXY(c.s0,c.w0),b=toXY(c.s1,c.w1);
   const col=c.n===0?"#e11d48":"#16a34a";
   mctx.fillStyle=col+"66";mctx.strokeStyle=col;mctx.lineWidth=1;
   mctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
   mctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
  });
 }

 /* MASKE: sadece park şekli kalır */
 mctx.globalCompositeOperation="destination-in";
 mctx.beginPath();
 PARK_POLY.forEach(r=>{
  r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?mctx.moveTo(xy[0],xy[1]):mctx.lineTo(xy[0],xy[1]);});
  mctx.closePath();
 });
 mctx.fill();
 mctx.globalCompositeOperation="source-over";

 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,W,H);
 ctx.drawImage(mapC,0,0);

 /* Sınır + waypoint maskeden sonra (keskin) */
 ctx.strokeStyle="#2b6cb0";ctx.lineWidth=3;ctx.setLineDash([12,8]);
 PARK_POLY.forEach(r=>{
  ctx.beginPath();
  r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?ctx.moveTo(xy[0],xy[1]):ctx.lineTo(xy[0],xy[1]);});
  ctx.closePath();ctx.stroke();
 });
 ctx.setLineDash([]);
 if(showWp){
  wpRows.forEach(w=>{
   const xy=toXY(w.lat,w.lon);
   ctx.fillStyle="#e11d48";ctx.beginPath();ctx.arc(xy[0],xy[1],5,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.stroke();
  });
 }

 const name=(PARK_CANDS[0]&&PARK_CANDS[0].name)||"İsimsiz Park";
 const haTotal=(polyArea(PARK_POLY)/10000).toFixed(1);
 ctx.fillStyle="#14532d";ctx.fillRect(0,0,W,64);
 ctx.fillStyle="#fff";ctx.font="bold 24px system-ui";
 ctx.fillText("🌳 "+name+" — Saha Raporu",24,40);

 const lines=[
  "DendroGeo · Park Raporu",
  "Park: "+name,
  "Toplam alan: "+haTotal+" ha (geodezik)",
  ...(PARK_REF_HA?["Referans: "+PARK_REF_HA+" ha (sapma %"+Math.abs(((polyArea(PARK_POLY)/10000-PARK_REF_HA)/PARK_REF_HA)*100).toFixed(1)+")"]:[]),
  incGrid?("Grid: "+GRID_CELLS.length+" hücre ("+($("gridSize")?.value||20)+"×"+($("gridSize")?.value||20)+" m)"):"Grid: —",
    ...(LANDCOVER?["Yüzey: Yeşil "+LANDCOVER.green+" ha · Sert "+LANDCOVER.hard+" ha · Su "+LANDCOVER.water+" ha"]:[]),
showWp?("Waypoint: "+wpRows.length):"Waypoint: —",
  "Altlık: "+(bg==="vector"?"Vektör":(bg==="osm"?"OSM":(bg==="sat"?"Uydu":"Topo")))+" · "+new Date().toLocaleDateString("tr-TR")
 ];
 const bw=380,bh=lines.length*24+20;
 ctx.fillStyle="rgba(255,255,255,.95)";ctx.strokeStyle="#94a3b8";ctx.lineWidth=1;
 ctx.fillRect(W-bw-24,H-bh-24,bw,bh);ctx.strokeRect(W-bw-24,H-bh-24,bw,bh);
 ctx.fillStyle="#1f2937";ctx.font="13px system-ui";
 lines.forEach((t,i)=>ctx.fillText(t,W-bw-8,H-bh-4+24*(i+1)));

 const lg=[];
 if(incGrid){lg.push(["#16a34a","Ölçülmüş"],["#e11d48","Boş"]);}
 if(showWp)lg.push(["#e11d48","Waypoint"]);
 if(incCover){lg.push(["#3b82f6","Su"],["#ef4444","Sert zemin"]);}
 lg.push(["#2b6cb0","Park sınırı"]);
 ctx.font="13px system-ui";
 lg.forEach((e,i)=>{
  const y=90+i*22;
  ctx.fillStyle=e[0];ctx.fillRect(W-190,y,16,14);
  ctx.strokeStyle="#333";ctx.strokeRect(W-190,y,16,14);
  ctx.fillStyle="#1f2937";ctx.fillText(e[1],W-168,y+12);
 });

 const mPerDeg=111320*Math.cos(((minLat+maxLat)/2)*Math.PI/180);
 const barPx=200*scale/mPerDeg;
 ctx.fillStyle="#1f2937";ctx.fillRect(24,H-36,barPx,8);
 ctx.font="bold 12px system-ui";ctx.fillText("200 m",24+barPx+8,H-28);

 canvas.toBlob(b=>{
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u;a.download="dendrogeo_"+name.replace(/[^a-z0-9_]/gi,"_")+"_rapor.png";a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
  toast("✓ Rapor PNG indirildi (yalnızca park alanı)","ok","🖼️");
 },"image/png");
}function setRefHa(v){
 PARK_REF_HA=parseFloat(v);
 if(!isFinite(PARK_REF_HA))PARK_REF_HA=null;
 renderRefBadge();
}
function renderRefBadge(){
 const el=$("refBadge");
 if(!el)return;
 if(!PARK_REF_HA||!PARK_POLY){el.textContent="";return;}
 const ha=polyArea(PARK_POLY)/10000;
 const dev=Math.abs(((ha-PARK_REF_HA)/PARK_REF_HA)*100);
 el.textContent="· Referans: "+PARK_REF_HA+" ha · Sapma: %"+dev.toFixed(1);
 el.style.color=dev<3?"#14532d":"#b45309";
}
