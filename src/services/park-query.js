"use strict";
/* DendroGeo · services/park-query.js — OSM PARK VERİSİ SORGULARI (Faz 4)
 * gridplan.js'ten birebir taşındı: Nominatim/Overpass park arama
 * (queryPark), detaylı su+sert yüzey kapsamı (queryDetailedCoverage) ve
 * su katmanı tazeleme (refreshWaterLayer).
 * Bağımlılıklar (çağrı anında global): osm-client.overpassRequest,
 * park-geometry.*, park-state.* */

/* =========================================================
   PARK QUERY
========================================================= */

async function queryPark(
  lat,
  lon,
  radius=1200
){
  const q1=
    `[out:json][timeout:35];(`+
    `way["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+
    `relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+
    `);`+
    `out geom;`;

  const parkData=await overpassRequest(q1,"park");

  if(!parkData||!Array.isArray(parkData.elements)||parkData.remark){
    const fallback=await dgParkBoundaryFallback(lat,lon,radius);
    if(fallback.length)return fallback;
    throw new Error("OSM park sınırı alınamadı. Bağlantı hatası parkın bulunmadığı anlamına gelmez; yeniden deneyin.");
  }
  if(!parkData.elements.length)return [];

  const cands=[];

  for(const el of parkData.elements){
    const geometry=extractRings(el);

    if(!geometry)continue;

    const hasGeometry=
      Array.isArray(geometry)
        ? geometry.length>0
        : (
          geometry.outer &&
          geometry.outer.length>0
        );

    if(!hasGeometry)continue;

    const area=polyArea(geometry);

    cands.push({
      rings:geometry,
      name:(el.tags&&el.tags.name)||null,
      area,
      type:el.type,
      id:el.id
    });
  }

  if(!cands.length)throw new Error("OSM park geometrisi eksik; yeniden deneyin.");

  const validCands=cands.filter(c=>{
    if(Array.isArray(c.rings)){
      return c.rings.some(r=>Array.isArray(r)&&r.length>=4);
    }
    return !!(
      c.rings &&
      Array.isArray(c.rings.outer) &&
      c.rings.outer.some(r=>Array.isArray(r)&&r.length>=4)
    );
  });

  if(!validCands.length)throw new Error("OSM park geometrisi geçersiz; yeniden deneyin.");

  const inside=validCands.filter(c=>
    pointInPark(
      lat,
      lon,
      c.rings
    )
  );

  const sorted=inside.length
    ? inside.slice().sort((a,b)=>a.area-b.area)
    : validCands.slice().sort((a,b)=>a.area-b.area);

  return sorted;
}

/* A geocoding result is only a candidate: never substitute its bounding box
 * for a park boundary. Use the actual OSM polygon, including all holes. */
const DG_PARK_BOUNDARY_CACHE=new Map();
let DG_PARK_NOMINATIM_QUEUE=Promise.resolve(),DG_PARK_NOMINATIM_TIME=0;
function dgParkNominatim(params){
 const task=DG_PARK_NOMINATIM_QUEUE.catch(()=>{}).then(async()=>{
  const wait=Math.max(0,1000-(Date.now()-DG_PARK_NOMINATIM_TIME));
  if(wait)await new Promise(r=>setTimeout(r,wait));
  DG_PARK_NOMINATIM_TIME=Date.now();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const res=await fetch("https://nominatim.openstreetmap.org/"+params.path+"?"+new URLSearchParams(params.query),{headers:{Accept:"application/json"},signal:controller.signal});
   if(!res.ok)throw new Error("OSM sınır servisi HTTP "+res.status);
   const data=await res.json();if(!Array.isArray(data))throw new Error("OSM sınır yanıtı geçersiz");return data;
  }finally{clearTimeout(timer);}
 });DG_PARK_NOMINATIM_QUEUE=task;return task;
}
function dgParkGeojsonCandidate(item){
 if(!['way','relation'].includes(item.osm_type)||!Number.isSafeInteger(Number(item.osm_id))||Number(item.osm_id)<=0)return null;
 const g=item.geojson,polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:null;
 if(!Array.isArray(polys)||!polys.length)return null;
 const rings={outer:[],inner:[]};
 for(const poly of polys){if(!Array.isArray(poly)||!poly.length)return null;for(let i=0;i<poly.length;i++){
  const ring=poly[i];if(!Array.isArray(ring)||ring.length<4||ring.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90))return null;
  if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])return null;
  rings[i?'inner':'outer'].push(ring.map(p=>[p[1],p[0]]));
 }}
 const area=polyArea(rings);if(!(area>0))return null;
 return {name:item.name||item.display_name?.split(',')[0]||null,type:item.osm_type,id:Number(item.osm_id),rings,area,boundaryProvider:'nominatim'};
}
async function dgParkBoundaryFallback(lat,lon,radius){
 const cached=[...DG_PARK_BOUNDARY_CACHE.values()].filter(x=>Date.now()-x.time<600000&&pointInPark(lat,lon,x.park.rings)).map(x=>x.park);
 if(cached.length)return cached.sort((a,b)=>a.area-b.area);
 const dLat=radius/111320,dLon=radius/(111320*Math.max(.1,Math.cos(lat*Math.PI/180)));
 const results=await dgParkNominatim({path:'search',query:{q:'[park]',format:'jsonv2',bounded:'1',limit:'40',viewbox:[lon-dLon,lat+dLat,lon+dLon,lat-dLat].join(',')}});
 // Search can return points or omit polygon output. Look up only OSM parks
 // whose advertised extent contains the selected point, then verify polygon containment.
 const candidates=results.filter(x=>(x.category||x.class)==='leisure'&&x.type==='park'&&['way','relation'].includes(x.osm_type)&&/^\d+$/.test(String(x.osm_id))&&Array.isArray(x.boundingbox)&&x.boundingbox.length===4&&lat>=Number(x.boundingbox[0])&&lat<=Number(x.boundingbox[1])&&lon>=Number(x.boundingbox[2])&&lon<=Number(x.boundingbox[3])).slice(0,10);
 if(!candidates.length)return [];
 const data=await dgParkNominatim({path:'lookup',query:{osm_ids:candidates.map(x=>(x.osm_type==='way'?'W':'R')+x.osm_id).join(','),format:'jsonv2',polygon_geojson:'1'}});
 const allowed=new Set(candidates.map(x=>x.osm_type+'/'+x.osm_id)),parks=[];
 for(const item of data){if(!allowed.has(item.osm_type+'/'+item.osm_id))continue;const park=dgParkGeojsonCandidate(item);if(park&&pointInPark(lat,lon,park.rings)){DG_PARK_BOUNDARY_CACHE.set(park.type+'/'+park.id,{park,time:Date.now()});parks.push(park);}}
 return parks.sort((a,b)=>a.area-b.area);
}

/* =========================================================
   DETAILED COVERAGE QUERY
========================================================= */

function queryDetailedCoverage(){
 const boundary=JSON.stringify(PARK_POLY);
 if(window.DG_SURFACE_OSM_PENDING?.boundary===boundary)return window.DG_SURFACE_OSM_PENDING.promise;
 const promise=dgQueryDetailedCoverage();
 window.DG_SURFACE_OSM_PENDING={boundary,promise};
 promise.finally(()=>{if(window.DG_SURFACE_OSM_PENDING?.promise===promise)window.DG_SURFACE_OSM_PENDING=null;}).catch(()=>{});
 return promise;
}

async function dgQueryDetailedCoverage(){
  if(
    !PARK_POLY||
    !PARK_POLY.length
  ){
    return false;
  }

  const boundary=JSON.stringify(PARK_POLY);
  // A failed refresh may not erase previously verified same-park geometries.
  if(window.DG_SURFACE_OSM?.boundary!==boundary){
    window.DG_SURFACE_OSM=null;
    IMP_RINGS=[];IMP_LINES=[];GRID_BLOCK_LINES=[];WATER_RINGS=[];WATER_LINES=[];
  }

  let minLat=90;
  let maxLat=-90;
  let minLon=180;
  let maxLon=-180;

  PARK_POLY.forEach(r=>
    r.forEach(p=>{
      if(p[0]<minLat)minLat=p[0];
      if(p[0]>maxLat)maxLat=p[0];
      if(p[1]<minLon)minLon=p[1];
      if(p[1]>maxLon)maxLon=p[1];
    })
  );

  const pad=0.0005;

  const bbox=
    `${minLat-pad},${minLon-pad},`+
    `${maxLat+pad},${maxLon+pad}`;

  /*
   * TEK sorgu:
   * Su + bina + building:part + yol + area:highway +
   * otopark + spor alanları + sert surface.
   *
   * Böylece aynı park için 2-3 ayrı Overpass çağrısı
   * yapmak yerine tek veri seti kullanıyoruz.
   */
  const q=
    `[out:json][timeout:90];(`+
    `way["natural"="water"](${bbox});`+
    `relation["natural"="water"](${bbox});`+
    `way["water"](${bbox});`+
    `relation["water"](${bbox});`+
    `way["landuse"~"reservoir|basin"](${bbox});`+
    `relation["landuse"~"reservoir|basin"](${bbox});`+
    `way["leisure"="swimming_pool"](${bbox});`+
    `relation["leisure"="swimming_pool"](${bbox});`+
    `way["amenity"="fountain"](${bbox});`+
    `relation["amenity"="fountain"](${bbox});`+
    `way["waterway"="riverbank"](${bbox});`+
    `relation["waterway"="riverbank"](${bbox});`+

    `way["building"](${bbox});`+
    `relation["building"](${bbox});`+
    `way["building:part"](${bbox});`+
    `relation["building:part"](${bbox});`+
    `way["highway"](${bbox});`+
    `way["area:highway"](${bbox});`+
    `relation["area:highway"](${bbox});`+
    `way["landuse"="highway"](${bbox});`+
    `relation["landuse"="highway"](${bbox});`+
    `way["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
    `relation["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
    `way["leisure"~"pitch|track|playground"](${bbox});`+
    `relation["leisure"~"pitch|track|playground"](${bbox});`+
    `way["surface"~"asphalt|paved|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal"](${bbox});`+
    `relation["surface"~"asphalt|paved|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal"](${bbox});`+
    `way["man_made"~"pier|bridge"](${bbox});`+
    `relation["man_made"~"pier|bridge"](${bbox});`+
    `);out geom;`;

  const json=await overpassRequest(q,"yüzey+su");
  if(boundary!==JSON.stringify(PARK_POLY))return false;

  if(!json){
    console.warn(
      "Detaylı yüzey sorgusu başarısız:",
      LAST_OVERPASS_ERROR
    );
    return false;
  }

  IMP_RINGS=[];IMP_LINES=[];GRID_BLOCK_LINES=[];WATER_RINGS=[];WATER_LINES=[];
  window.DG_SURFACE_OSM={elements:json.elements||[],bbox:{minLat:minLat-pad,minLon:minLon-pad,maxLat:maxLat+pad,maxLon:maxLon+pad},boundary,fetchedAt:new Date().toISOString()};
  const seenWater=new Set();
  const seenImp=new Set();

  for(const el of (json.elements||[])){
    const id=el.type+":"+el.id;

    if(isWater(el)){
      if(seenWater.has(id))continue;
      seenWater.add(id);

      if(el.type==="relation"){
        const r=extractRings(el);

        if(r){
          if(Array.isArray(r)){
            r.forEach(rr=>{
              if(rr&&rr.length>=3)WATER_RINGS.push(rr);
            });
          }else if(r.outer){
            r.outer.forEach(rr=>{
              if(rr&&rr.length>=3)WATER_RINGS.push(rr);
            });
          }
        }
        continue;
      }

      if(!el.geometry)continue;

      const pts=el.geometry.map(g=>[g.lat,g.lon]);

      if(isClosedLine(pts)){
        WATER_RINGS.push(pts);
      }else if(pts.length>1){
        WATER_LINES.push(pts);
      }

      continue;
    }

    /*
     * Footway/path/pedestrian gibi yaya geometrileri surface etiketi
     * olmadığı için IMP olarak sınıflandırılmasa bile grid hücresini
     * engellemelidir. Arazi örtüsü hesabına sert alan olarak eklenmez.
     */
    if(el.type==="way" && el.tags && el.tags.highway){
      collectPedestrianGridBlocker(el);
    }

    if(!isImpervious(el))continue;
    if(seenImp.has(id))continue;

    seenImp.add(id);
    collectImperviousGeometry(el);
  }

  const pb={
    minLat,
    maxLat,
    minLon,
    maxLon
  };

  WATER_RINGS=WATER_RINGS.filter(r=>
    ringTouchesPark(r,PARK_POLY,pb)
  );

  WATER_LINES=WATER_LINES.filter(l=>
    lineTouchesPark(l,PARK_POLY,pb)
  );

  IMP_RINGS=IMP_RINGS.filter(r=>
    ringTouchesPark(r,PARK_POLY,pb)
  );

  IMP_LINES=IMP_LINES.filter(l=>
    lineTouchesPark(l.pts,PARK_POLY,pb)
  );

  GRID_BLOCK_LINES=(GRID_BLOCK_LINES||[])
    .map(l=>Array.isArray(l)
      ?{pts:l,w:IMP_CLEARANCE_M}
      :l
    )
    .filter(l=>
      l&&Array.isArray(l.pts)&&
      l.pts.length>=2&&
      lineTouchesPark(l.pts,PARK_POLY,pb)
    );

  // OSM surface geometry is kept as non-visual QC data for grid planning.
  console.log(
    "✓ Detaylı → Su polygon:",
    WATER_RINGS.length,
    "Su çizgi:",
    WATER_LINES.length,
    "Sert polygon:",
    IMP_RINGS.length,
    "Sert çizgi:",
    IMP_LINES.length
  );

  return true;
}

function refreshWaterLayer(){
  if(WATER_LAYER && map){
    map.removeLayer(WATER_LAYER);
  }

  WATER_LAYER=L.layerGroup().addTo(map);

    WATER_RINGS.forEach(r=>{
    if(!r||r.length<3)return;

    L.polygon(r,{
      color:"#2563eb",
      weight:1,
      dashArray:null,
      fillColor:"#60a5fa",
      fillOpacity:.42,
      interactive:false
    }).addTo(WATER_LAYER);
  });

  WATER_LINES.forEach(l=>{
    if(!l||l.length<2)return;

    L.polyline(l,{
      color:"#2563eb",
      weight:2,
      opacity:.55,
      dashArray:satelliteMode?"6 4":null,
      interactive:false
    }).addTo(WATER_LAYER);
  });
}
