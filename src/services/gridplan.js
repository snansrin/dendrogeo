

"use strict";
/ DendroGeo v2 · gridplan.js v38 — TÜM SORUNLAR DÜZELTİLDİ /

let PARK_POLY=null;
let PARK_HOLES=[];
let PARK_LAYER=null;
let PARK_MODE=false;
let PARKCLICKBOUND=false;
let PARK_CANDS=[];

let WATER_RINGS=[];
let WATER_LINES=[];
let WATER_LAYER=null;

let IMP_RINGS=[];
let IMP_LINES=[];
let IMP_LAYER=null;

let GRIDBLOCKLINES=[];

const GRID_CELLS=[];
let GRID_LAYER=null;
let WPAUTOLAYER=null;

const SELECTED_CELLS=new Set();

let LASTWPROWS=[];
let PARKREFHA=null;
let LANDCOVER=null;

const WATERCLEARANCEM=1;
const IMPCLEARANCEM=1;

const OVERPASS_URLS=[
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
];

/* =========================================================
   AREA
========================================================= */
function ringGeodesicArea(ring){
  const R=6378137;
  let t=0;
  for(let i=0;i=3)outerArea+=ringGeodesicArea(ring);
    }
    for(const ring of(rings.inner||[])){
      if(ring&&ring.length>=3)innerArea+=ringGeodesicArea(ring);
    }
    return Math.max(0,outerArea-innerArea);
  }
  let total=0;
  for(const ring of rings){
    if(!ring||ring.lengthmaxX)maxX=q.x;if(q.y>maxY)maxY=q.y;
  }
  return{minX,minY,maxX,maxY};
}

function expandBBox(x,d){
  return{minX:x.minX-d,minY:x.minY-d,maxX:x.maxX+d,maxY:x.maxY+d};
}

function bboxesOverlap(a,b){
  return!(a.maxXb.maxX||a.maxYb.maxY);
}

function pointInPolygonXY(x,y,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;iy)!==(yj>y))&&(xprojectPoint(q[0],q[1],lat));
  return pointInPolygonXY(p.x,p.y,poly);
}

function pointInPark(lat,lon,rings){
  if(!rings)return false;
  if(Array.isArray(rings)){
    if(!rings.length)return false;
    const insideOuter=rings.some(r=>pointInPolygon(lat,lon,r));
    if(!insideOuter)return false;
    const insideHole=PARK_HOLES.some(r=>pointInPolygon(lat,lon,r));
    return!insideHole;
  }
  if(rings.outer){
    const insideOuter=rings.outer.some(r=>pointInPolygon(lat,lon,r));
    if(!insideOuter)return false;
    const insideHole=(rings.inner||[]).some(r=>pointInPolygon(lat,lon,r));
    return!insideHole;
  }
  return false;
}

/* =========================================================
   SEGMENT / RECT
========================================================= */
function orientation(a,b,c){
  const v=(b.x-a.x)(c.y-a.y)-(b.y-a.y)(c.x-a.x);
  if(Math.abs(v)0?1:2;
}

function onSegment(a,b,p){
  return p.x>=Math.min(a.x,b.x)-1e-9&&p.x=Math.min(a.y,b.y)-1e-9&&p.y=rect.minX&&a.x=rect.minY&&a.y=rect.minX&&b.x=rect.minY&&b.yprojectPoint(p[0],p[1],refLat));
  const sourceBox=expandBBox(ringBBox(points,refLat),bufferM);
  const testRect=expandBBox(rect,bufferM);
  if(!bboxesOverlap(sourceBox,testRect))return false;
  for(const p of pts){
    if(p.x>=testRect.minX&&p.x=testRect.minY&&p.yprojectPoint(p[0],p[1],refLat));
  for(let i=0;i=2;
}

function isCellValid(s0,s1,w0,w1){
  if(!cellInsidePark(s0,s1,w0,w1))return false;
  const cLat=(s0+s1)/2;
  const cellRect=ringBBox([[s0,w0],[s0,w1],[s1,w1],[s1,w0]],cLat);
  for(const w of WATER_RINGS){
    if(geometryIntersectsRect(w,cellRect,cLat,WATERCLEARANCEM))return false;
  }
  for(const l of WATER_LINES){
    if(geometryLineIntersectsRect(l,cellRect,cLat,WATERCLEARANCEM))return false;
  }
  for(const b of IMP_RINGS){
    if(geometryIntersectsRect(b,cellRect,cLat,IMPCLEARANCEM))return false;
  }
  for(const l of GRIDBLOCKLINES){
    if(geometryLineIntersectsRect(l,cellRect,cLat,IMPCLEARANCEM))return false;
  }
  return true;
}

/* =========================================================
   PARK QUERY — DÜZELTİLDİ: water tag + geniş bbox
========================================================= */
async function queryPark(lat,lon,radius=1200){
  const q1=[out:json][timeout:25];(+
    way"leisure"~"park|garden|naturereserve|common|recreationground";+
    relation"leisure"~"park|garden|naturereserve|common|recreationground";+
    );out geom;;

  let parkData=null;
  for(const url of OVERPASS_URLS){
    try{
      const res=await fetch(url+"?data="+encodeURIComponent(q1));
      if(!res.ok)continue;
      parkData=await res.json();
      break;
    }catch(e){}
  }

  if(!parkData||!parkData.elements||!parkData.elements.length)return null;

  const cands=[];
  for(const el of parkData.elements){
    const geometry=extractRings(el);
    if(!geometry)continue;
    const hasGeometry=Array.isArray(geometry)?geometry.length>0:(geometry.outer&&geometry.outer.length>0);
    if(!hasGeometry)continue;
    const area=polyArea(geometry);
    cands.push({rings:geometry,name:(el.tags&&el.tags.name)||null,area,type:el.type,id:el.id});
  }

  if(!cands.length)return null;

  const inside=cands.filter(c=>pointInPark(lat,lon,c.rings));
  let sorted;
  if(inside.length){
    sorted=inside.slice().sort((a,b)=>{
      if(a.name&&b.name&&a.name===b.name)return a.area-b.area;
      return a.area-b.area;
    });
  }else{
    sorted=cands.slice().sort((a,b)=>a.area-b.area);
  }

  const park=sorted[0];
  WATER_RINGS=[];
  WATER_LINES=[];

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  const parkOuter=Array.isArray(park.rings)?park.rings:park.rings.outer;
  parkOuter.forEach(r=>r.forEach(p=>{
    if(p[0]maxLat)maxLat=p[0];
    if(p[1]maxLon)maxLon=p[1];
  }));

  const pad=0.0005;
  const bbox=${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad};

  const q2=[out:json][timeout:60];(+
    way"natural"="water";+
    relation"natural"="water";+
    way"water";+
    relation"water";+
    way"landuse"="reservoir";+
    relation"landuse"="reservoir";+
    way"landuse"="basin";+
    relation"landuse"="basin";+
    way"leisure"="swimming_pool";+
    relation"leisure"="swimming_pool";+
    way"waterway"="riverbank";+
    relation"waterway"="riverbank";+
    );out geom;;

  for(const url of OVERPASS_URLS){
    try{
      const res=await fetch(url+"?data="+encodeURIComponent(q2));
      if(!res.ok)continue;
      const json=await res.json();
      for(const el of(json.elements||[])){
        if(!isWater(el))continue;
        if(el.type==="relation"){
          const r=extractRings(el);
          if(!r)continue;
          if(Array.isArray(r)){r.forEach(rr=>WATER_RINGS.push(rr));}
          else if(r.outer){r.outer.forEach(rr=>WATER_RINGS.push(rr));}
          continue;
        }
        if(!el.geometry)continue;
        const line=el.geometry.map(g=>[g.lat,g.lon]);
        if(isClosedLine(line))WATER_RINGS.push(line);
        else if(line.length>1)WATER_LINES.push(line);
      }
      break;
    }catch(e){}
  }

  const pb={minLat,maxLat,minLon,maxLon};
  WATERRINGS=WATERRINGS.filter(r=>ringTouchesPark(r,park.rings,pb));
  WATERLINES=WATERLINES.filter(l=>lineTouchesPark(l,park.rings,pb));

  console.log(✓ Su: ${WATERRINGS.length} poligon, ${WATERLINES.length} çizgi);
  return sorted;
}

/* =========================================================
   DETAILED COVERAGE — DÜZELTİLDİ: relation sorguları eklendi
========================================================= */
async function queryDetailedCoverage(){
  if(!PARKPOLY||!PARKPOLY.length)return;

  IMP_RINGS=[];
  IMP_LINES=[];
  GRIDBLOCKLINES=[];

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  PARK_POLY.forEach(r=>r.forEach(p=>{
    if(p[0]maxLat)maxLat=p[0];
    if(p[1]maxLon)maxLon=p[1];
  }));

  const pad=0.0005;
  const bbox=${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad};

  const q=[out:json][timeout:90];(+
    way"building";+
    relation"building";+
    way"highway";+
    relation"highway";+
    way"amenity"~"parking|bicycleparking|motorcycleparking";+
    relation"amenity"~"parking|bicycleparking|motorcycleparking";+
    way"leisure"~"pitch|track|playground";+
    relation"leisure"~"pitch|track|playground";+
    way"surface"~"asphalt|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal|wood";+
    relation"surface"~"asphalt|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal|wood";+
    way"man_made"~"pier|bridge";+
    );out geom;;

  for(const url of OVERPASS_URLS){
    try{
      const res=await fetch(url+"?data="+encodeURIComponent(q));
      if(!res.ok)continue;
      const json=await res.json();
      let collected=0;
      for(const el of(json.elements||[])){
        if(isWater(el))continue;
        if(!isImpervious(el))continue;
        collectImperviousGeometry(el);
        collected++;
      }
      console.log(✓ Coverage: ${collected} element toplandı);
      break;
    }catch(e){}
  }

  const pb={minLat,maxLat,minLon,maxLon};
  const beforeRings=IMP_RINGS.length;
  const beforeLines=IMP_LINES.length;

  IMPRINGS=IMPRINGS.filter(r=>ringTouchesPark(r,PARK_POLY,pb));
  IMPLINES=IMPLINES.filter(l=>lineTouchesPark(l.pts,PARK_POLY,pb));
  GRIDBLOCKLINES=GRIDBLOCKLINES.filter(l=>lineTouchesPark(l,PARK_POLY,pb));

  console.log(✓ Coverage filtre: Rings ${beforeRings}→${IMPRINGS.length}, Lines ${beforeLines}→${IMPLINES.length});
  refreshImpLayer();
}

/* =========================================================
   PARK INTERSECTION — DÜZELTİLDİ: segment kesişimi eklendi
========================================================= */
function ringTouchesPark(ring,parkRings,pb){
  if(!ring||ring.lengthmaxLat)maxLat=p[0];
    if(p[1]maxLon)maxLon=p[1];
  }

  const buf=0.0005;
  if(maxLatpb.maxLat+buf||maxLonpb.maxLon+buf){
    return false;
  }

  for(const p of ring){
    if(pointInPark(p[0],p[1],parkRings))return true;
  }

  const centerLat=(minLat+maxLat)/2;
  const centerLon=(minLon+maxLon)/2;
  if(pointInPark(centerLat,centerLon,parkRings))return true;

  for(let i=0;imaxLat)maxLat=p[0];
    if(p[1]maxLon)maxLon=p[1];
  }

  const buf=0.0005;
  if(maxLatpb.maxLat+buf||maxLonpb.maxLon+buf){
    return false;
  }

  for(const p of line){
    if(pointInPark(p[0],p[1],parkRings))return true;
  }

  for(let i=0;i1e-7||Math.abs(a[1]-b[1])>1e-7){
      r.push([a[0],a[1]]);
    }
    return r.length>=4?r:null;
  }

  if(el.type==="way"&&el.geometry){
    const r=el.geometry.map(g=>[g.lat,g.lon]);
    const closed=closeRing(r);
    return closed?[closed]:null;
  }

  if(el.type==="relation"&&el.members){
    const outerWays=el.members.filter(m=>m.role==="outer"&&m.geometry).map(m=>m.geometry.map(g=>[g.lat,g.lon]));
    const innerWays=el.members.filter(m=>m.role==="inner"&&m.geometry).map(m=>m.geometry.map(g=>[g.lat,g.lon]));
    const outer=joinWaysToRings(outerWays);
    const inner=joinWaysToRings(innerWays);
    if(!outer.length)return null;
    return{outer,inner};
  }

  return null;
}

function joinWaysToRings(ways){
  const rings=[];
  const rem=ways.slice();
  const eq=(a,b)=>Math.abs(a[0]-b[0])0){
      merged=false;
      for(let i=0;i2){
      if(!eq(ch[0],ch[ch.length-1])){ch.push([ch[0][0],ch[0][1]]);}
      rings.push(ch);
    }
  }
  return rings;
}

/* =========================================================
   WATER — DÜZELTİLDİ: water tag eklendi
========================================================= */
function isWater(el){
  const t=el.tags||{};
  return(
    t.natural==="water"||
    !!t.water||
    t.landuse==="reservoir"||
    t.landuse==="basin"||
    t.leisure==="swimming_pool"||
    t.waterway==="riverbank"
  );
}

/* =========================================================
   IMPERVIOUS
========================================================= */
function isImpervious(el){
  const t=el.tags||{};
  const surface=String(t.surface||"").toLowerCase().trim();

  const hardSurfaces=new Set([
    "asphalt","concrete","paving_stones","sett",
    "concrete:plates","concrete:lanes","cobblestone",
    "bricks","metal","wood"
  ]);

  const softSurfaces=new Set([
    "grass","dirt","earth","ground","gravel","fine_gravel",
    "sand","mud","unpaved","compacted","woodchips","pebblestone","clay"
  ]);

  if(t.building)return true;
  if(hardSurfaces.has(surface))return true;
  if(softSurfaces.has(surface))return false;

  if(t.amenity==="parking"||t.amenity==="bicycleparking"||t.amenity==="motorcycleparking")return true;

  if(t.leisure==="pitch"||t.leisure==="track"||t.leisure==="playground"){
    return hardSurfaces.has(surface);
  }

  if(t.highway){
    const hw=String(t.highway).toLowerCase();
    const softWays=new Set(["footway","path","cycleway","steps","pedestrian","bridleway","track"]);
    if(softWays.has(hw))return hardSurfaces.has(surface);
    if(softSurfaces.has(surface))return false;
    return true;
  }

  if(t.manmade==="pier"||t.manmade==="bridge")return true;

  return false;
}

function isClosedLine(l){
  return l&&l.length>2&&
    Math.abs(l[0][0]-l[l.length-1][0]){if(rr&&rr.length>=3)IMP_RINGS.push(rr);});}
    else if(r.outer){r.outer.forEach(rr=>{if(rr&&rr.length>=3)IMP_RINGS.push(rr);});}
    return;
  }

  if(!el.geometry)return;
  const pts=el.geometry.map(g=>[g.lat,g.lon]);
  if(pts.length0&&width{
    if(!PARK_MODE)return;
    toast("🌳 Park sorgulanıyor…","info");
    const parks=await queryPark(e.latlng.lat,e.latlng.lng);
    if(!parks||!parks.length)return toast("Park bulunamadı.","warn");
    PARK_CANDS=parks;
    drawPark(parks[0]);
  });
}

/* =========================================================
   DRAW PARK
========================================================= */
function drawPark(park){
  ensurePngUiStyles();
  clearPark();
  clearGrid();

  PARK_POLY=Array.isArray(park.rings)?park.rings:park.rings.outer;
  PARK_HOLES=Array.isArray(park.rings)?[]:(park.rings.inner||[]);

  PARK_LAYER=L.layerGroup().addTo(map);
  L.polygon(PARKPOLY,{color:"#2b6cb0",weight:2.5,dashArray:"6,6",fillColor:"#3b82f6",fillOpacity:.10,interactive:false}).addTo(PARKLAYER);
  PARK_HOLES.forEach(r=>{
    L.polygon(r,{color:"#2b6cb0",weight:1.5,fillColor:"#ffffff",fillOpacity:.85,interactive:false}).addTo(PARK_LAYER);
  });

  if(WATER_RINGS.length){
    WATER_LAYER=L.layerGroup().addTo(map);
    WATERRINGS.forEach(r=>L.polygon(r,{color:"#2563eb",weight:1,fillColor:"#60a5fa",fillOpacity:.4,interactive:false}).addTo(WATERLAYER));
  }
  if(WATER_LINES.length){
    if(!WATERLAYER)WATERLAYER=L.layerGroup().addTo(map);
    WATERLINES.forEach(l=>L.polyline(l,{color:"#2563eb",weight:2,opacity:.5,interactive:false}).addTo(WATERLAYER));
  }

  const parkBounds=L.latLngBounds(PARK_POLY);
  if(PARKHOLES&&PARKHOLES.length){PARK_HOLES.forEach(ring=>{ring.forEach(p=>{parkBounds.extend(p);});});}
  if(parkBounds.isValid())map.fitBounds(parkBounds,{padding:[30,30]});

  const haTotal=parkAreaHa().toFixed(1);
  const alt=PARK_CANDS.length>1
    ?+
      PARK_CANDS.map((c,i)=>${esc(c.name||"Alan "+(i+1))} · ${(c.area/10000).toFixed(1)} ha).join("")+
      :"";

  $("parkInfo").style.display="block";
  $("parkInfo").innerHTML=
    +
      🌳 ${esc(park.name||"İsimsiz Park")}+
      ${haTotal} ha+
      +alt+
    +
    +
      +
        1 · GRID & WAYPOINT+
        🔲 Grid sistemi+
        Ölçüm alanını otomatik böl+
      +
      +
        PROJE+
          +
            (typeof PROJLIST!=="undefined"&&PROJLIST.length?PROJ_LIST.map(p=>${esc(p.name)}).join(""):Önce proje oluştur)+
          +
        GRID BOYUTU+
          +
            10 × 10 m · Hassas+
            20 × 20 m · Standart+
            50 × 50 m · Hızlı+
          +
        REFERANS ALAN (HA)+
          +
      +
      🔲 Grid Oluştur+
    +
    +
      2 · YÜZEY ANALİZİ+
      🌿 Arazi örtüsü+
      Bina · yol · otopark · saha · su+
    3m örnekleme+
    🌿 Yüzey Örtüsü Analizi+
    Park sınırının içinde tek sorgu. Yeşil + Sert + Su = Toplam.+
    +
    +
      3 · RAPOR PNG+
      🖼️ Harita çıktısı+
      Park şeklinde yüksek çözünürlük+
    +
    ALTLIK+
      +
        Vektör · Temiz beyaz+
        OSM · Sokak+
        Uydu+
        Topoğrafik+
      +
    GÖRÜNÜM KATMANLARI+
      +
        🔲Grid hücreleriAnaliz hücrelerini göster+
        📍Waypoint'lerÖlçüm noktaları+
        💧Su / sert zeminYapısal yüzeyler+
      +
    🖼️ PNG İndir+
    +
    +
      4 · KATMANLAR+
      🗺️ Görünürlük+
      Harita üzerindeki katmanlar+
    +
    +
      🔲Grid hücreleriHarita üzerinde göster+
      📍Waypoint'lerÖlçüm noktalarını göster+
    +
    ✕ Tümünü Temizle+
    +
    +
    +
    ;

  renderRefBadge();
  toast("✓ Park algılandı: "+haTotal+" ha","ok","🌳");
}

/* =========================================================
   MODERN UI STYLES
========================================================= */
function ensurePngUiStyles(){
  if(document.getElementById("dgPngUiStyles"))return;
  const style=document.createElement("style");
  style.id="dgPngUiStyles";
  style.textContent=
    .dg-png-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--bg);display:flex;flex-direction:column;gap:10px}
    .dg-png-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .dg-png-kicker{font-size:.66rem;letter-spacing:.12em;color:var(--mut);font-weight:700;margin-bottom:3px;text-transform:uppercase}
    .dg-png-title{font-size:.92rem;font-weight:700;line-height:1.25}
    .dg-png-sub{font-size:.72rem;color:var(--mut);line-height:1.4;margin-top:2px}
    .dg-png-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:.68rem;font-weight:700;background:rgba(34,197,94,.12);color:#16a34a;white-space:nowrap}
    .dg-png-badge.amber{background:rgba(245,158,11,.14);color:#b45309}
    .dg-png-badge.blue{background:rgba(59,130,246,.14);color:#1d4ed8}
    .dg-png-label{display:block;font-size:.62rem;letter-spacing:.1em;font-weight:700;color:var(--mut);margin-bottom:5px;text-transform:uppercase}
    .dg-png-fields{display:flex;flex-direction:column;gap:8px}
    .dg-png-field{display:flex;flex-direction:column}
    .dg-png-select,.dg-png-input{width:100%;min-height:36px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:inherit;font-size:.8rem;font-family:inherit;outline:none;transition:border-color .15s ease,box-shadow .15s ease}
    .dg-png-select:focus,.dg-png-input:focus{border-color:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.12)}
    .dg-png-options{border:1px solid var(--line);border-radius:11px;overflow:hidden;background:var(--bg)}
    .dg-png-option{position:relative;display:flex;align-items:center;gap:10px;min-height:54px;padding:9px 11px;cursor:pointer;transition:background .16s ease,transform .08s ease;user-select:none}
    .dg-png-option+.dg-png-option{border-top:1px solid var(--line)}
    .dg-png-option:hover{background:rgba(128,128,128,.06)}
    .dg-png-option:active{transform:scale(.995)}
    .dg-png-option input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
    .dg-png-icon{width:30px;height:30px;flex:0 0 30px;display:grid;place-items:center;border-radius:9px;background:rgba(128,128,128,.10);font-size:.92rem}
    .dg-png-copy{flex:1;min-width:0}
    .dg-png-copy strong{display:block;font-size:.78rem;font-weight:700;line-height:1.25}
    .dg-png-copy span{display:block;margin-top:2px;color:var(--mut);font-size:.66rem;line-height:1.3}
    .dg-png-switch{position:relative;width:38px;height:22px;flex:0 0 38px;border-radius:999px;background:#aab2bd;transition:background .18s ease}
    .dg-png-switch::after{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .18s ease}
    .dg-png-option input:checked+.dg-png-switch{background:#16a34a}
    .dg-png-option input:checked+.dg-png-switch::after{transform:translateX(16px)}
    .dg-png-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:40px;padding:9px 14px;border-radius:10px;border:1px solid transparent;font-size:.82rem;font-weight:700;letter-spacing:.01em;cursor:pointer;transition:transform .08s ease,box-shadow .18s ease,background .15s ease,border-color .15s ease;background:var(--btn-bg,#14532d);color:var(--btn-fg,#fff);font-family:inherit}
    .dg-png-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.08)}
    .dg-png-btn:active{transform:translateY(0);box-shadow:none}
    .dg-png-btn.primary{background:linear-gradient(180deg,#16a34a,#15803d);color:#fff}
    .dg-png-btn.blue{background:linear-gradient(180deg,#3b82f6,#1d4ed8);color:#fff}
    .dg-png-btn.ghost{background:transparent;color:inherit;border-color:var(--line)}
    .dg-png-btn.ghost:hover{background:rgba(128,128,128,.06)}
    .dg-png-btn.red{background:linear-gradient(180deg,#ef4444,#b91c1c);color:#fff}
    .dg-png-btn.sm{min-height:34px;font-size:.76rem;padding:6px 12px}
    .dg-png-result{margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:11px;background:var(--bg);font-size:.82rem;line-height:1.6}
    #refBadge.dg-png-ref{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:600;background:rgba(20,83,45,.1)}
  ;
  document.head.appendChild(style);
}

/* =========================================================
   CLEAR
========================================================= */
function clearPark(){
  if(PARKLAYER&&map){map.removeLayer(PARKLAYER);PARK_LAYER=null;}
  if(WATERLAYER&&map){map.removeLayer(WATERLAYER);WATER_LAYER=null;}
  if(IMPLAYER&&map){map.removeLayer(IMPLAYER);IMP_LAYER=null;}
  PARKPOLY=null;PARKHOLES=[];
  WATERRINGS=[];WATERLINES=[];
  IMPRINGS=[];IMPLINES=[];GRIDBLOCKLINES=[];
  LANDCOVER=null;
}

function switchPark(i){const p=PARK_CANDS[i];if(p)drawPark(p);}

/* =========================================================
   GRID
========================================================= */
async function buildGrid(){
  if(!PARKPOLY||!PARKPOLY.length)return toast("Önce park seç");
  const size=+$("gridSize").value||20;
  const est=Math.round(parkAreaM2()/(size*size));
  if(est>3000)return toast("⚠ ~"+est+" hücre çok yoğun.","err");
  if(est>800&&!confirm(⚠ ~${est} hücre.\nDevam?))return;
  clearGrid();

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  PARK_POLY.forEach(r=>r.forEach(p=>{
    if(p[0]maxLat)maxLat=p[0];
    if(p[1]maxLon)maxLon=p[1];
  }));

  const lat0=((minLat+maxLat)/2)*Math.PI/180;
  const dLat=size/110540;
  const dLon=size/(111320*Math.max(.1,Math.cos(lat0)));
  const cellMap={};
  GRID_CELLS.length=0;

  for(let rI=0;;rI++){
    const s0=minLat+rI*dLat,s1=s0+dLat;
    if(s0>=maxLat)break;
    for(let cI=0;;cI++){
      const w0=minLon+cI*dLon,w1=w0+dLon;
      if(w0>=maxLon)break;
      if(!isCellValid(s0,s1,w0,w1))continue;
      const cell={lat:(s0+s1)/2,lon:(w0+w1)/2,s0,s1,w0,w1,n:0,id:rI+"_"+cI};
      cellMap[cell.id]=cell;
      GRID_CELLS.push(cell);
    }
  }

  const{data}=await sb.from("measurements").select("lat,lon").eq("status","Onaylı").gte("lat",minLat).lte("lat",maxLat).gte("lon",minLon).lte("lon",maxLon).limit(5000);
  (data||[]).forEach(m=>{
    const cell=cellMap[Math.floor((m.lat-minLat)/dLat)+"_"+Math.floor((m.lon-minLon)/dLon)];
    if(cell)cell.n++;
  });

  SELECTED_CELLS.clear();
  drawGridLayer();
  toast("✓ Grid hazır: "+GRID_CELLS.length+" hücre","ok","🔲");
}

function drawGridLayer(){
  if(GRIDLAYER&&map)map.removeLayer(GRIDLAYER);
  GRID_LAYER=L.layerGroup().addTo(map);
  let g=0,r0=0;
  GRID_CELLS.forEach(cell=>{
    const col=cell.n===0?"#e11d48":"#16a34a";
    if(cell.n===0)r0++;else g++;
    const isSel=SELECTED_CELLS.has(cell.id);
    const rect=L.rectangle([[cell.s0,cell.w0],[cell.s1,cell.w1]],{
      color:isSel?"#1d4ed8":col,weight:isSel?3:1.2,fillColor:isSel?"#3b82f6":col,fillOpacity:isSel?.55:.32,interactive:true
    }).addTo(GRID_LAYER);
    rect._cellId=cell.id;
    rect.on("click",e=>{L.DomEvent.stopPropagation(e);toggleCellSelection(cell.id,rect);});
    rect.bindTooltip(Hücre ${cell.id} · ${cell.n} ölçüm,{sticky:true});
  });
  updateGridSummary(g,r0);
}

function updateGridSummary(g,r0){
  const gs=$("gridSummary");if(gs)gs.style.display="block";
  const tot=GRID_CELLS.length;
  const pct=v=>tot?Math.round(v/tot*100):0;
  const selCount=SELECTED_CELLS.size;
  gs.innerHTML=
    📊 Grid · ${$("gridSize")?.value||20}×${$("gridSize")?.value||20} m+
    Toplam: ${tot} · 🟢 Ölçülmüş: ${g} (%${pct(g)}) · 🔴 Boş: ${r0} (%${pct(r0)})+
    (selCount>0?🔵 Seçili: ${selCount}:"")+
    +
    (r0>0?📍 Otomatik (${r0}):"")+
    (selCount>0?📍 Seçili (${selCount}):"")+
    (selCount>0?✕ Seçimi Temizle:"")+
    📥 GeoJSON+
    📥 WP CSV+
    ;
}

function toggleCellSelection(cellId,rect){
  if(SELECTED_CELLS.has(cellId)){
    SELECTED_CELLS.delete(cellId);
    const cell=GRID_CELLS.find(c=>c.id===cellId);
    if(cell){const col=cell.n===0?"#e11d48":"#16a34a";rect.setStyle({color:col,weight:1.2,fillColor:col,fillOpacity:.32});}
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
        const cell=GRIDCELLS.find(c=>c.id===l.cellId);
        if(cell){const col=cell.n===0?"#e11d48":"#16a34a";l.setStyle({color:col,weight:1.2,fillColor:col,fillOpacity:.32});}
      }
    });
  }
  let g=0,r0=0;
  GRID_CELLS.forEach(c=>{if(c.n===0)r0++;else g++;});
  updateGridSummary(g,r0);
}

function clearGrid(){
  if(GRIDLAYER&&map){map.removeLayer(GRIDLAYER);GRID_LAYER=null;}
  if(WPAUTOLAYER&&map){map.removeLayer(WPAUTOLAYER);WPAUTOLAYER=null;}
  GRIDCELLS.length=0;SELECTEDCELLS.clear();
  const gs=$("gridSummary");if(gs){gs.innerHTML="";gs.style.display="none";}
  const togGrid=$("togGrid");if(togGrid)togGrid.checked=true;
  const togWp=$("togWp");if(togWp)togWp.checked=true;
}

function toggleGridVis(){
  if(!GRID_LAYER)return;const togEl=$("togGrid");
  if(map.hasLayer(GRIDLAYER)){map.removeLayer(GRIDLAYER);if(togEl)togEl.checked=false;}
  else{map.addLayer(GRID_LAYER);if(togEl)togEl.checked=true;}
}

function toggleWpVis(){
  if(!WPAUTOLAYER)return;const togEl=$("togWp");
  if(map.hasLayer(WPAUTOLAYER)){map.removeLayer(WPAUTOLAYER);if(togEl)togEl.checked=false;}
  else{map.addLayer(WPAUTOLAYER);if(togEl)togEl.checked=true;}
}

/* =========================================================
   WAYPOINT
========================================================= */
async function createWaypointsFromGrid(mode){
  if(!GRID_CELLS.length)return toast("Önce grid oluştur");
  const pid=+$("gridProject").value||0;
  if(!pid)return toast("Önce proje seç");
  let targetCells=mode==="manual"?GRIDCELLS.filter(c=>SELECTEDCELLS.has(c.id)):GRID_CELLS.filter(c=>c.n===0);
  if(mode==="manual"&&!SELECTED_CELLS.size)return toast("Önce hücre seçin");
  if(!targetCells.length)return toast("Uygun hücre yok");
  if(targetCells.length>500&&!confirm(targetCells.length+" waypoint?\nDevam?"))return;

  const{data:mx}=await sb.from("waypoints").select("wpid").eq("projectid",pid).order("wp_id",{ascending:false}).limit(1);
  let next=(mx&&mx.length?mx[0].wp_id:0)+1;
  const first=next;
  const rows=targetCells.map(c=>({owner:USER.id,projectid:pid,wpid:next++,lat:+c.lat.toFixed(6),lon:+c.lon.toFixed(6),visited:false}));
  LASTWPROWS=rows;
  const{error}=await sb.from("waypoints").insert(rows);
  if(error)return toast("Hata: "+error.message,"err");

  if(WPAUTOLAYER&&map)map.removeLayer(WPAUTOLAYER);
  WPAUTOLAYER=L.layerGroup().addTo(map);
  rows.forEach(r=>L.circleMarker([r.lat,r.lon],{radius:5,color:"#fff",weight:1.5,fillColor:"#e11d48",fillOpacity:.95,interactive:false}).addTo(WPAUTOLAYER));
  $("nProject").value=String(pid);
  loadWaypoints();
  toast("✓ "+rows.length+" waypoint (P"+first+"–P"+(next-1)+")","ok","📍");
  clearCellSelection();
}

/* =========================================================
   LINE UTILITIES
========================================================= */
function lineLengthM(l){
  let len=0;
  for(let i=1;iURL.revokeObjectURL(u),1000);
}

function downloadGridGeoJSON(){
  if(!GRID_CELLS.length)return toast("Önce grid");
  const fc={type:"FeatureCollection",features:GRID_CELLS.map(c=>({
    type:"Feature",properties:{id:c.id,olcum:c.n,durum:c.n===0?"bos":"olculmus"},
    geometry:{type:"Polygon",coordinates:[[[c.w0,c.s0],[c.w1,c.s0],[c.w1,c.s1],[c.w0,c.s1],[c.w0,c.s0]]]}
  }))};
  downloadBlob("dendrogeo_grid.geojson","application/geo+json",JSON.stringify(fc,null,2));
  toast("✓ Grid indirildi","ok","📥");
}

function downloadWaypointsCSV(){
  const rows=LASTWPROWS.length?LASTWPROWS:WP;
  if(!rows||!rows.length)return toast("WP yok");
  let csv="wp_id,lat,lon,visited\n";
  rows.forEach(r=>{csv+=r.wp_id+","+r.lat+","+r.lon+","+(r.visited?1:0)+"\n";});
  downloadBlob("dendrogeo_wp.csv","text/csv",csv);
  toast("✓ "+rows.length+" WP","ok","📥");
}

/* =========================================================
   LAND COVER GEOMETRY
========================================================= */
function pointToSegmentDistanceM(lat,lon,a,b){
  const refLat=lat*Math.PI/180;
  const ax=(a[1]-lon)111320Math.cos(refLat);
  const ay=(a[0]-lat)*110540;
  const bx=(b[1]-lon)111320Math.cos(refLat);
  const by=(b[0]-lat)*110540;
  const dx=bx-ax,dy=by-ay;
  if(dx===0&&dy===0)return Math.sqrt(axax+ayay);
  const t=Math.max(0,Math.min(1,(-axdx-aydy)/(dxdx+dydy)));
  const px=ax+tdx,py=ay+tdy;
  return Math.sqrt(pxpx+pypy);
}

function nearLineW(lines,lat,lon){
  for(const l of lines){
    if(!l||!l.pts||l.pts.length{
    if(!r||r.length{
    if(!l||!l.pts||l.pts.length({pts:l.pts,w:l.w}));

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  PARK_POLY.forEach(r=>r.forEach(p=>{
    if(p[0]maxLat)maxLat=p[0];
    if(p[1]maxLon)maxLon=p[1];
  }));

  const SAMPLE_M=3;
  const stepLat=SAMPLE_M/110540;
  const stepLon=SAMPLE_M/(111320Math.cos(((minLat+maxLat)/2)Math.PI/180));

  let nPark=0,nWater=0,nImp=0,nGreen=0;

  for(let la=minLat;la=3&&pointInPolygon(la,lo,r)){inWater=true;break;}
      }
      if(!inWater){
        for(const l of WATER_LINES){
          if(!l||l.length((v/Math.max(1,nPark))*totalHa).toFixed(1);
  const pct=v=>nPark?Math.round(v/nPark*100):0;

  LANDCOVER={green:+ha(nGreen),hard:+ha(nImp),water:+ha(nWater),total:+totalHa.toFixed(1)};

  const row=(color,label,haV,pv)=>
    +
      +
      ${label}+
      +
        +
      +
      ${haV} ha+
      %${pv}+
    ;

  if(rep){
    rep.innerHTML=
      🌿 Yüzey Örtüsü (bina·yol·otopark·saha·kort dahil)+
      row("#16a34a","Yeşil",ha(nGreen),pct(nGreen))+
      row("#ef4444","Sert",ha(nImp),pct(nImp))+
      row("#3b82f6","Su",ha(nWater),pct(nWater))+
      +
        Toplam: ${totalHa.toFixed(1)} ha · Yeşil+Sert+Su = Toplam+
        Örnekleme: ${SAMPLE_M} m · Örnek nokta: ${nPark.toLocaleString("tr-TR")}+
        Sert poligon: ${IMPRINGS.length} · Sert çizgi: ${IMPLINES.length} · Su poligon: ${WATER_RINGS.length}+
      ;
  }

  toast("✓ Analiz tamam","ok","🌿");
}

/* =========================================================
   TILE DRAW
========================================================= */
async function drawTiles(ctx,bg,minLat,minLon,maxLat,maxLon,scale,ox,oy){
  const urls={
    osm:(x,y,z)=>https://tile.openstreetmap.org/${z}/${x}/${y}.png,
    sat:(x,y,z)=>https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x},
    topo:(x,y,z)=>https://a.tile.opentopomap.org/${z}/${x}/${y}.png
  };
  const zoom=Math.min(19,Math.max(3,Math.round(Math.log2(360*scale/256))));
  const n=Math.pow(2,zoom);
  const x0=Math.floor((minLon+180)/360*n);
  const x1=Math.floor((maxLon+180)/360*n);
  const yFor=lat=>{const r=latMath.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2n);};
  const y0=yFor(maxLat),y1=yFor(minLat);
  const lonOf=x=>x/n*360-180;
  const latOf=y=>Math.atan(Math.sinh(Math.PI(1-2y/n)))*180/Math.PI;
  const imgs=[];
  for(let x=x0;xo.img.decode?o.img.decode():new Promise((res,rej)=>{o.img.onload=res;o.img.onerror=rej;})));}
  catch(e){return false;}
  for(const o of imgs){
    const p0=[ox+(lonOf(o.x)-minLon)scale,oy+(maxLat-latOf(o.y))scale];
    const p1=[ox+(lonOf(o.x+1)-minLon)scale,oy+(maxLat-latOf(o.y+1))scale];
    ctx.drawImage(o.img,p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]);
  }
  try{ctx.getImageData(0,0,1,1);}catch(e){return false;}
  return true;
}

/* =========================================================
   PNG
========================================================= */
async function downloadParkImage(){
  if(!PARKPOLY||!PARKPOLY.length)return toast("Önce park seç");
  const bg=$("pngBg")?$("pngBg").value:"vector";
  const incGrid=($("chkPngGrid")?$("chkPngGrid").checked:true)&&GRID_CELLS.length>0;
  const incWp=$("chkPngWp")?$("chkPngWp").checked:true;
  const incCover=$("chkPngCover")?$("chkPngCover").checked:true;
  const wpRows=(LASTWPROWS.length?LASTWPROWS:WP).filter(w=>pointInPark(w.lat,w.lon,PARK_POLY));
  const showWp=incWp&&wpRows.length>0;
  const W=1600,H=1200;
  const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext("2d");
  const mapC=document.createElement("canvas");mapC.width=W;mapC.height=H;
  const mctx=mapC.getContext("2d");
  mctx.fillStyle="#ffffff";mctx.fillRect(0,0,W,H);

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  PARK_POLY.forEach(r=>r.forEach(p=>{
    if(p[0]maxLat)maxLat=p[0];
    if(p[1]maxLon)maxLon=p[1];
  }));
  const pad=.0004;
  minLat-=pad;maxLat+=pad;minLon-=pad;maxLon+=pad;
  const dLat=maxLat-minLat,dLon=maxLon-minLon;
  const scale=Math.min((W-140)/dLon,(H-200)/dLat);
  const ox=(W-dLonscale)/2,oy=(H-dLatscale)/2+30;
  const toXY=(lat,lon)=>[ox+(lon-minLon)scale,oy+(maxLat-lat)scale];

  if(bg!=="vector"){
    const ok=await drawTiles(mctx,bg,minLat,minLon,maxLat,maxLon,scale,ox,oy);
    if(!ok){mctx.fillStyle="#ffffff";mctx.fillRect(0,0,W,H);toast("⚠ Tile yüklenemedi","warn");}
  }

  if(incCover){
    IMP_RINGS.forEach(r=>{
      if(!r||r.length{const xy=toXY(p[0],p[1]);if(i===0)mctx.moveTo(xy[0],xy[1]);else mctx.lineTo(xy[0],xy[1]);});
      mctx.closePath();mctx.fill();mctx.stroke();
    });
    IMP_LINES.forEach(l=>{
      mctx.strokeStyle="#ef444466";mctx.lineWidth=Math.max(1.5,(l.w2)scale/110540);mctx.beginPath();
      l.pts.forEach((p,i)=>{const xy=toXY(p[0],p[1]);if(i===0)mctx.moveTo(xy[0],xy[1]);else mctx.lineTo(xy[0],xy[1]);});
      mctx.stroke();
    });
    WATER_RINGS.forEach(r=>{
      if(!r||r.length{const xy=toXY(p[0],p[1]);if(i===0)mctx.moveTo(xy[0],xy[1]);else mctx.lineTo(xy[0],xy[1]);});
      mctx.closePath();mctx.fill();mctx.stroke();
    });
    WATER_LINES.forEach(l=>{
      mctx.strokeStyle="#3b82f699";mctx.lineWidth=2;mctx.beginPath();
      l.forEach((p,i)=>{const xy=toXY(p[0],p[1]);if(i===0)mctx.moveTo(xy[0],xy[1]);else mctx.lineTo(xy[0],xy[1]);});
      mctx.stroke();
    });
  }

  if(incGrid){
    GRID_CELLS.forEach(c=>{
      const a=toXY(c.s0,c.w0),b=toXY(c.s1,c.w1);
      const col=c.n===0?"#e11d48":"#16a34a";
      mctx.fillStyle=col+"66";mctx.strokeStyle=col;mctx.lineWidth=1;
      mctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);mctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
    });
  }

  mctx.globalCompositeOperation="destination-in";mctx.beginPath();
  PARK_POLY.forEach(r=>{r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);if(i===0)mctx.moveTo(xy[0],xy[1]);else mctx.lineTo(xy[0],xy[1]);});mctx.closePath();});
  PARK_HOLES.forEach(r=>{r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);if(i===0)mctx.moveTo(xy[0],xy[1]);else mctx.lineTo(xy[0],xy[1]);});mctx.closePath();});
  mctx.fill("evenodd");mctx.globalCompositeOperation="source-over";

  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,W,H);ctx.drawImage(mapC,0,0);
  ctx.strokeStyle="#2b6cb0";ctx.lineWidth=3;ctx.setLineDash([12,8]);
  PARK_POLY.forEach(r=>{ctx.beginPath();r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);if(i===0)ctx.moveTo(xy[0],xy[1]);else ctx.lineTo(xy[0],xy[1]);});ctx.closePath();ctx.stroke();});
  ctx.setLineDash([]);
  PARK_HOLES.forEach(r=>{ctx.beginPath();r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);if(i===0)ctx.moveTo(xy[0],xy[1]);else ctx.lineTo(xy[0],xy[1]);});ctx.closePath();ctx.stroke();});

  if(showWp){
    wpRows.forEach(w=>{
      const xy=toXY(w.lat,w.lon);
      ctx.fillStyle="#e11d48";ctx.beginPath();ctx.arc(xy[0],xy[1],5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.stroke();
    });
  }

  const name=(PARKCANDS[0]&&PARKCANDS[0].name)||"İsimsiz Park";
  const haTotal=parkAreaHa().toFixed(1);
  ctx.fillStyle="#14532d";ctx.fillRect(0,0,W,64);
  ctx.fillStyle="#fff";ctx.font="bold 24px system-ui";
  ctx.fillText("🌳 "+name+" — Saha Raporu",24,40);

  const lines=["DendroGeo · Park Raporu","Park: "+name,"Toplam alan: "+haTotal+" ha (geodezik)"];
  if(PARKREFHA)lines.push("Referans: "+PARKREFHA+" ha (sapma %"+Math.abs(((parkAreaHa()-PARKREFHA)/PARKREFHA)*100).toFixed(1)+")");
  if(LANDCOVER)lines.push("Yeşil "+LANDCOVER.green+" ha · Sert "+LANDCOVER.hard+" ha · Su "+LANDCOVER.water+" ha");
  if(incGrid)lines.push("Grid: "+GRID_CELLS.length+" hücre");
  if(showWp)lines.push("Waypoint: "+wpRows.length);
  lines.push("Altlık: "+(bg==="vector"?"Vektör":bg==="osm"?"OSM":bg==="sat"?"Uydu":"Topo")+" · "+new Date().toLocaleDateString("tr-TR"));

  const bw=380,bh=lines.length*24+20;
  ctx.fillStyle="rgba(255,255,255,.95)";ctx.strokeStyle="#94a3b8";ctx.lineWidth=1;
  ctx.fillRect(W-bw-24,H-bh-24,bw,bh);ctx.strokeRect(W-bw-24,H-bh-24,bw,bh);
  ctx.fillStyle="#1f2937";ctx.font="13px system-ui";
  lines.forEach((t,i)=>ctx.fillText(t,W-bw-8,H-bh-4+24*(i+1)));

  const lg=[];
  if(incGrid)lg.push(["#16a34a","Ölçülmüş"],["#e11d48","Boş"]);
  if(showWp)lg.push(["#e11d48","Waypoint"]);
  if(incCover)lg.push(["#3b82f6","Su"],["#ef4444","Sert"]);
  lg.push(["#2b6cb0","Park sınırı"]);
  ctx.font="13px system-ui";
  lg.forEach((e,i)=>{
    const y=90+i*22;
    ctx.fillStyle=e[0];ctx.fillRect(W-190,y,16,14);
    ctx.strokeStyle="#333";ctx.strokeRect(W-190,y,16,14);
    ctx.fillStyle="#1f2937";ctx.fillText(e[1],W-168,y+12);
  });

  const mPerDeg=111320Math.cos(((minLat+maxLat)/2)Math.PI/180);
  const barPx=200*scale/mPerDeg;
  ctx.fillStyle="#1f2937";ctx.fillRect(24,H-36,barPx,8);
  ctx.font="bold 12px system-ui";ctx.fillText("200 m",24+barPx+8,H-28);

  canvas.toBlob(b=>{
    const u=URL.createObjectURL(b);
    const a=document.createElement("a");a.href=u;
    a.download="dendrogeo"+name.replace(/[^a-z0-9]/gi,"")+"rapor.png";a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
    toast("✓ PNG indirildi","ok","🖼️");
  },"image/png");
}

/* =========================================================
   REFERENCE AREA
========================================================= */
function setRefHa(v){
  PARKREFHA=parseFloat(v);
  if(!isFinite(PARKREFHA))PARKREFHA=null;
  renderRefBadge();
}

function renderRefBadge(){
  const el=$("refBadge");
  if(!el)return;
  if(!PARKREFHA||!PARK_POLY){el.style.display="none";el.textContent="";return;}
  const ha=parkAreaHa();
  const dev=Math.abs(((ha-PARKREFHA)/PARKREFHA)*100);
  el.style.display="inline-flex";
  el.textContent="Referans: "+PARKREFHA+" ha · Sapma: %"+dev.toFixed(1);
  if(dev<3){el.style.background="rgba(22,163,74,.12)";el.style.color="#16a34a";}
  else{el.style.background="rgba(245,158,11,.14)";el.style.color="#b45309";}
}

console.log("✓ DendroGeo gridplan v38 loaded — su+sert+alan düzeltmeleri aktif");

