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

const DG_PARK_CANDIDATE_SEARCH=window.DG_PARK_CANDIDATE_SEARCH_APPLICATION.create({
  queryOsm:query=>overpassRequest(query,"park",{maxAttempts:1}),
  boundaryFallback:(lat,lon,radius)=>dgParkBoundaryFallback(lat,lon,radius),
  extractRings:element=>extractRings(element),
  areaOf:rings=>polyArea(rings),
  containsPoint:(lat,lon,rings)=>pointInPark(lat,lon,rings)
});
async function queryPark(lat,lon,radius=1200){
  return DG_PARK_CANDIDATE_SEARCH(lat,lon,radius);
}

/* A geocoding result is only a candidate: never substitute its bounding box
 * for a park boundary. Use the actual OSM polygon, including all holes. */
const DG_PARK_BOUNDARY_CACHE=new Map();
const DG_NOMINATIM_CLIENT=window.DG_NOMINATIM_CLIENT_ADAPTER.create();
function dgParkNominatim(params){return DG_NOMINATIM_CLIENT.request(params);}
const DG_NOMINATIM_BOUNDARY=window.DG_NOMINATIM_BOUNDARY_APPLICATION.create({
 cache:DG_PARK_BOUNDARY_CACHE,
 fetchNominatim:params=>dgParkNominatim(params),
 areaOf:rings=>polyArea(rings),
 containsPoint:(lat,lon,rings)=>pointInPark(lat,lon,rings)
});
function dgParkGeojsonCandidate(item){return DG_NOMINATIM_BOUNDARY.geojsonCandidate(item);}
async function dgParkBoundaryFallback(lat,lon,radius){return DG_NOMINATIM_BOUNDARY.findBoundary(lat,lon,radius);}

/* =========================================================
   DETAILED COVERAGE QUERY
========================================================= */

const DG_PARK_COVERAGE_FETCH=window.DG_PARK_COVERAGE_FETCH_APPLICATION.create({
  getParkPolygon:()=>PARK_POLY,
  queryOsm:(query,label,options)=>overpassRequest(query,label,options),
  queryFallback:window.DG_LOAD_OSM_MAP_COVERAGE?.load,
  preferFallback:()=>[...OVERPASS_HEALTH.values()].some(health=>Math.max(health.badUntil||0,health.degradedUntil||0)>Date.now())
});

function queryDetailedCoverage(){
 if(window.DG_SHARE_DETAILED_COVERAGE_REQUEST)return window.DG_SHARE_DETAILED_COVERAGE_REQUEST.request(JSON.stringify(PARK_POLY),{
  getPending:()=>window.DG_SURFACE_OSM_PENDING,
  setPending:pending=>{window.DG_SURFACE_OSM_PENDING=pending;},
  clearPending:()=>{window.DG_SURFACE_OSM_PENDING=null;},
  run:()=>dgQueryDetailedCoverage()
 });
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
  if(window.DG_COMMIT_PARK_COVERAGE_SNAPSHOT){
    window.DG_COMMIT_PARK_COVERAGE_SNAPSHOT.clearForChangedBoundary(boundary,{
      getCoverage:()=>window.DG_SURFACE_OSM,
      clearCoverage:()=>{window.DG_SURFACE_OSM=null;},
      clearGeometry:()=>{IMP_RINGS=[];IMP_LINES=[];GRID_BLOCK_LINES=[];WATER_RINGS=[];WATER_LINES=[];}
    });
  }else if(window.DG_SURFACE_OSM?.boundary!==boundary){
    window.DG_SURFACE_OSM=null;
    IMP_RINGS=[];IMP_LINES=[];GRID_BLOCK_LINES=[];WATER_RINGS=[];WATER_LINES=[];
  }

  const coverage=await DG_PARK_COVERAGE_FETCH();
  if(!coverage||coverage.stale||coverage.boundary!==boundary)return false;
  const {boundary:fetchedBoundary,bbox:coverageBbox,pad,json}=coverage;
  const {minLat,maxLat,minLon,maxLon}=coverageBbox;

  if(!json){
    window.DG_SURFACE_OSM_FAILURE={boundary,bbox:coverageBbox,time:Date.now()};
    console.warn(
      "Detaylı yüzey sorgusu başarısız:",
      LAST_OVERPASS_ERROR
    );
    return false;
  }

  window.DG_SURFACE_OSM_FAILURE=null;
  IMP_RINGS=[];IMP_LINES=[];GRID_BLOCK_LINES=[];WATER_RINGS=[];WATER_LINES=[];
  window.DG_SURFACE_OSM=window.DG_COMMIT_PARK_COVERAGE_SNAPSHOT
    ?window.DG_COMMIT_PARK_COVERAGE_SNAPSHOT.commit({elements:json.elements,bbox:coverageBbox,pad,boundary:fetchedBoundary,fetchedAt:new Date().toISOString()})
    :{elements:json.elements||[],bbox:{minLat:minLat-pad,minLon:minLon-pad,maxLat:maxLat+pad,maxLon:maxLon+pad},boundary:fetchedBoundary,fetchedAt:new Date().toISOString()};
  const classified=window.DG_PARK_COVERAGE_ELEMENT_CLASSIFIER.classify(json.elements||[],{
    isWater:element=>isWater(element),
    isImpervious:element=>isImpervious(element)
  });

  if(window.DG_COLLECT_PARK_COVERAGE_ELEMENTS){
    window.DG_COLLECT_PARK_COVERAGE_ELEMENTS.collect(classified,{
      extractRings, isClosedLine,
      addWaterRing:ring=>WATER_RINGS.push(ring),
      addWaterLine:line=>WATER_LINES.push(line),
      collectPedestrianGridBlocker,collectImperviousGeometry
    });
  }else for(const item of classified){
    const {element:el}=item;

    if(item.skip)continue;
    if(item.water){

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
    if(item.pedestrian){
      collectPedestrianGridBlocker(el);
    }

    if(!item.impervious)continue;
    collectImperviousGeometry(el);
  }

  const pb={
    minLat,
    maxLat,
    minLon,
    maxLon
  };

  if(window.DG_FILTER_PARK_COVERAGE_TO_BOUNDARY){
    const filtered=window.DG_FILTER_PARK_COVERAGE_TO_BOUNDARY.filter({
      waterRings:WATER_RINGS,waterLines:WATER_LINES,imperviousRings:IMP_RINGS,imperviousLines:IMP_LINES,
      gridBlockLines:GRID_BLOCK_LINES,park:PARK_POLY,bounds:pb,clearance:IMP_CLEARANCE_M,
      isRingTouching:ringTouchesPark,lineTouches:lineTouchesPark
    });
    WATER_RINGS=filtered.waterRings;WATER_LINES=filtered.waterLines;IMP_RINGS=filtered.imperviousRings;
    IMP_LINES=filtered.imperviousLines;GRID_BLOCK_LINES=filtered.gridBlockLines;
  }else{
    WATER_RINGS=WATER_RINGS.filter(r=>ringTouchesPark(r,PARK_POLY,pb));
    WATER_LINES=WATER_LINES.filter(l=>lineTouchesPark(l,PARK_POLY,pb));
    IMP_RINGS=IMP_RINGS.filter(r=>ringTouchesPark(r,PARK_POLY,pb));
    IMP_LINES=IMP_LINES.filter(l=>lineTouchesPark(l.pts,PARK_POLY,pb));
    GRID_BLOCK_LINES=(GRID_BLOCK_LINES||[])
      .map(l=>Array.isArray(l)?{pts:l,w:IMP_CLEARANCE_M}:l)
      .filter(l=>l&&Array.isArray(l.pts)&&l.pts.length>=2&&lineTouchesPark(l.pts,PARK_POLY,pb));
  }

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
  if(window.DG_PARK_WATER_LAYER_RENDERER)return window.DG_PARK_WATER_LAYER_RENDERER.refresh({
    layer:WATER_LAYER,map,leaflet:L,rings:WATER_RINGS,lines:WATER_LINES,satelliteMode,
    setLayer:layer=>{WATER_LAYER=layer;}
  });
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
