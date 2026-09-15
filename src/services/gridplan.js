/* DendroGeo gridplan loader v38
   The stable UI/core stays in gridplan_core.js; this file applies the park geometry fixes. */

document.write('<script src="src/services/gridplan_core.js?v=38"><\/script>');

/* =========================================================
   PARK GEOMETRY / LAND-COVER FIXES
========================================================= */

const DG_HARD=new Set([
  "asphalt","concrete","paving_stones","sett",
  "concrete:plates","concrete:lanes","cobblestone",
  "bricks","metal","wood"
]);

const DG_SOFT=new Set([
  "grass","dirt","earth","ground","gravel","fine_gravel",
  "sand","mud","unpaved","compacted","woodchips","pebbles"
]);

const DG_SOFT_HW=new Set([
  "footway","path","cycleway","steps","pedestrian","bridleway","track"
]);

function isWater(el){
  const t=el?.tags||{};
  return t.natural==="water" || !!t.water ||
    t.landuse==="reservoir" || t.landuse==="basin" ||
    t.leisure==="swimming_pool" || t.waterway==="riverbank";
}

function isImpervious(el){
  const t=el?.tags||{};
  const surface=String(t.surface||"").toLowerCase().trim();

  if(t.building)return true;
  if(DG_HARD.has(surface))return true;

  if([
    "parking","bicycle_parking","motorcycle_parking"
  ].includes(t.amenity))return true;

  if([
    "pitch","track","playground"
  ].includes(t.leisure)){
    return DG_HARD.has(surface);
  }

  if(t.highway){
    const hw=String(t.highway).toLowerCase();

    if(DG_SOFT.has(surface))return false;
    if(DG_SOFT_HW.has(hw))return DG_HARD.has(surface);

    /* Vehicle roads with no explicit soft surface are treated as hard. */
    return true;
  }

  return false;
}

function collectWaterGeometry(el){
  if(!el)return;

  const r=extractRings(el);

  if(el.type==="relation" && r){
    if(Array.isArray(r))WATER_RINGS.push(...r);
    else WATER_RINGS.push(...(r.outer||[]));
    return;
  }

  if(!el.geometry)return;

  const pts=el.geometry.map(g=>[g.lat,g.lon]);

  if(isClosedLine(pts))WATER_RINGS.push(pts);
  else if(pts.length>1)WATER_LINES.push(pts);
}

function collectImperviousGeometry(el){
  if(!el)return;

  if(el.type==="relation"){
    const r=extractRings(el);
    if(r){
      if(Array.isArray(r))IMP_RINGS.push(...r);
      else IMP_RINGS.push(...(r.outer||[]));
    }
    return;
  }

  if(!el.geometry)return;

  const pts=el.geometry.map(g=>[g.lat,g.lon]);
  if(pts.length<2)return;

  const t=el.tags||{};
  const surface=String(t.surface||"").toLowerCase().trim();
  const closed=isClosedLine(pts);

  const area=
    !!t.building ||
    ["parking","bicycle_parking","motorcycle_parking"].includes(t.amenity) ||
    DG_HARD.has(surface) ||
    (["pitch","track","playground"].includes(t.leisure)&&DG_HARD.has(surface));

  /* Only truly closed geometry may become a polygon. */
  if(closed && area){
    IMP_RINGS.push(pts);
    return;
  }

  if(t.highway){
    const hw=String(t.highway).toLowerCase();

    if(DG_SOFT.has(surface))return;
    if(DG_SOFT_HW.has(hw) && !DG_HARD.has(surface))return;

    const taggedWidth=parseFloat(
      String(t.width||"").replace(",",".")
    );

    const halfWidth=
      Number.isFinite(taggedWidth) && taggedWidth>0 && taggedWidth<30
        ? taggedWidth/2
        : roadHalfWidth(hw);

    IMP_LINES.push({
      pts,
      w:Math.max(.5,halfWidth)
    });

    return;
  }

  /* Open hard-surface geometry is a line, never a fake polygon. */
  if(DG_HARD.has(surface)){
    IMP_LINES.push({
      pts,
      w:1.5
    });
  }
}

function isCellValid(s0,s1,w0,w1){
  if(!cellInsidePark(s0,s1,w0,w1))return false;

  const cLat=(s0+s1)/2;
  const rect=ringBBox([
    [s0,w0],[s0,w1],[s1,w1],[s1,w0]
  ],cLat);

  for(const r of WATER_RINGS){
    if(geometryIntersectsRect(r,rect,cLat,WATER_CLEARANCE_M))return false;
  }

  for(const l of WATER_LINES){
    if(geometryLineIntersectsRect(l,rect,cLat,WATER_CLEARANCE_M))return false;
  }

  for(const r of IMP_RINGS){
    if(geometryIntersectsRect(r,rect,cLat,IMP_CLEARANCE_M))return false;
  }

  for(const l of IMP_LINES){
    if(geometryLineIntersectsRect(
      l.pts,
      rect,
      cLat,
      Math.max(IMP_CLEARANCE_M,Number(l.w)||0)
    ))return false;
  }

  return true;
}

/* =========================================================
   VISUAL CLIPPING — keeps water/hard geometry inside park
========================================================= */

function dgApplyParkClip(layer){
  try{
    if(!layer||!map||!PARK_POLY?.length)return;

    const pane=map.getPanes()?.overlayPane;
    if(!pane)return;

    const svg=pane.querySelector("svg");
    if(!svg)return;

    let defs=svg.querySelector("defs");
    if(!defs){
      defs=document.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs"
      );
      svg.insertBefore(defs,svg.firstChild);
    }

    const id=
      "dgParkClip_"+
      Date.now()+"_"+
      Math.random().toString(36).slice(2,8);

    const clip=document.createElementNS(
      "http://www.w3.org/2000/svg",
      "clipPath"
    );

    clip.id=id;
    clip.setAttribute("clipPathUnits","userSpaceOnUse");

    const path=document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );

    let d="";

    for(const ring of PARK_POLY){
      ring.forEach((p,i)=>{
        const q=map.latLngToLayerPoint(p);
        d+=(i?"L":"M")+q.x+" "+q.y+" ";
      });
      d+="Z ";
    }

    for(const ring of (PARK_HOLES||[])){
      ring.forEach((p,i)=>{
        const q=map.latLngToLayerPoint(p);
        d+=(i?"L":"M")+q.x+" "+q.y+" ";
      });
      d+="Z ";
    }

    path.setAttribute("d",d);
    path.setAttribute("fill-rule","evenodd");
    clip.appendChild(path);
    defs.appendChild(clip);

    layer.eachLayer(l=>{
      if(l&&l._path){
        l._path.setAttribute("clip-path",`url(#${id})`);
      }
    });
  }catch(e){
    console.warn("DendroGeo park clip:",e);
  }
}

/* =========================================================
   DRAW PARK — preserve water loaded by queryPark
========================================================= */

const DG_originalDrawPark=drawPark;

drawPark=function(park){
  const savedWaterRings=WATER_RINGS.slice();
  const savedWaterLines=WATER_LINES.slice();
  const originalClearPark=clearPark;

  /* Original drawPark calls clearPark(), which used to erase the
     freshly downloaded water before it could be drawn. */
  clearPark=function(){
    originalClearPark();
    WATER_RINGS=savedWaterRings.slice();
    WATER_LINES=savedWaterLines.slice();
  };

  try{
    DG_originalDrawPark(park);
  }finally{
    clearPark=originalClearPark;
  }

  setTimeout(()=>dgApplyParkClip(WATER_LAYER),120);
  setTimeout(()=>dgApplyParkClip(IMP_LAYER),120);
};

/* =========================================================
   DETAILED COVERAGE — stricter OSM interpretation
========================================================= */

const DG_originalQueryDetailedCoverage=queryDetailedCoverage;

queryDetailedCoverage=async function(){
  if(!PARK_POLY?.length)return;

  IMP_RINGS=[];
  IMP_LINES=[];
  GRID_BLOCK_LINES=[];

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;

  for(const ring of PARK_POLY){
    for(const p of ring){
      minLat=Math.min(minLat,p[0]);
      maxLat=Math.max(maxLat,p[0]);
      minLon=Math.min(minLon,p[1]);
      maxLon=Math.max(maxLon,p[1]);
    }
  }

  const pad=.0005;
  const bbox=`${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;

  const q=`[out:json][timeout:60];(`+
    `way["building"](${bbox});`+
    `relation["building"](${bbox});`+
    `way["highway"](${bbox});`+
    `way["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
    `way["leisure"~"pitch|track|playground"](${bbox});`+
    `way["surface"~"asphalt|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal|wood"](${bbox});`+
    `);out geom;`;

  let data=null;

  for(const url of OVERPASS_URLS){
    try{
      const res=await fetch(
        url+"?data="+encodeURIComponent(q)
      );
      if(!res.ok)continue;
      data=await res.json();
      break;
    }catch(e){}
  }

  for(const el of (data?.elements||[])){
    if(isWater(el))continue;
    if(!isImpervious(el))continue;
    collectImperviousGeometry(el);
  }

  const pb={minLat,maxLat,minLon,maxLon};

  IMP_RINGS=IMP_RINGS.filter(r=>
    ringTouchesPark(r,PARK_POLY,pb)
  );

  IMP_LINES=IMP_LINES.filter(l=>
    lineTouchesPark(l.pts,PARK_POLY,pb)
  );

  /* GRID_BLOCK_LINES is intentionally not populated here anymore.
     Road width is handled directly by IMP_LINES. */
  GRID_BLOCK_LINES=[];

  refreshImpLayer();

  console.log(
    "✓ Coverage fixed · polygons:",
    IMP_RINGS.length,
    "lines:",
    IMP_LINES.length
  );
};

/* =========================================================
   PARK QUERY — water tags + reliable geometry refresh
========================================================= */

const DG_originalQueryPark=queryPark;

queryPark=async function(lat,lon,radius=1200){
  const result=await DG_originalQueryPark(lat,lon,radius);
  if(!result?.length)return result;

  const park=result[0];
  const rings=
    Array.isArray(park.rings)
      ? park.rings
      : (park.rings.outer||[]);

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;

  for(const ring of rings){
    for(const p of ring){
      minLat=Math.min(minLat,p[0]);
      maxLat=Math.max(maxLat,p[0]);
      minLon=Math.min(minLon,p[1]);
      maxLon=Math.max(maxLon,p[1]);
    }
  }

  const pad=.0005;
  const bbox=`${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;

  WATER_RINGS=[];
  WATER_LINES=[];

  const q=`[out:json][timeout:60];(`+
    `way["natural"="water"](${bbox});`+
    `relation["natural"="water"](${bbox});`+
    `way["water"](${bbox});`+
    `relation["water"](${bbox});`+
    `way["landuse"="reservoir"](${bbox});`+
    `relation["landuse"="reservoir"](${bbox});`+
    `way["landuse"="basin"](${bbox});`+
    `relation["landuse"="basin"](${bbox});`+
    `way["leisure"="swimming_pool"](${bbox});`+
    `relation["leisure"="swimming_pool"](${bbox});`+
    `way["waterway"="riverbank"](${bbox});`+
    `relation["waterway"="riverbank"](${bbox});`+
    `);out geom;`;

  for(const url of OVERPASS_URLS){
    try{
      const res=await fetch(
        url+"?data="+encodeURIComponent(q)
      );
      if(!res.ok)continue;

      const data=await res.json();

      for(const el of (data.elements||[])){
        if(isWater(el))collectWaterGeometry(el);
      }

      break;
    }catch(e){}
  }

  const pb={minLat,maxLat,minLon,maxLon};

  WATER_RINGS=WATER_RINGS.filter(r=>
    ringTouchesPark(r,rings,pb)
  );

  WATER_LINES=WATER_LINES.filter(l=>
    lineTouchesPark(l,rings,pb)
  );

  return result;
};

console.log("✓ DendroGeo gridplan geometry patch v38 loaded");
