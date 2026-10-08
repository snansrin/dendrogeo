/* DendroGeo GIS — read-only OSM water geometry rescue.
 * The source is an OSM water way previously verified in the Göksu map (way/423602740).
 * Only used when Overpass supplies no water geometry; NEVER guesses a lake
 * boundary from raster color, changes ESA raw cells or accepts a report.
 * Nominatim lookup is one bounded GET with a short-lived cache. */
(()=>{
 "use strict";
 const WAY_ID=423602740;
 const ENDPOINT="https://nominatim.openstreetmap.org/lookup";
 let cached=null,expires=0,pending=null;

 function bboxValid(b){
  return !!b&&[b.minLat,b.minLon,b.maxLat,b.maxLon].every(Number.isFinite)&&b.maxLat>b.minLat&&b.maxLon>b.minLon;
 }
 function intersects(a,b){
  return a.minLat<b.maxLat&&a.maxLat>b.minLat&&a.minLon<b.maxLon&&a.maxLon>b.minLon;
 }
 function inArea(b){
  // A tightly bounded discovery area, not a substitute for geometric intersection.
  return bboxValid(b)&&b.maxLat-b.minLat<0.1&&b.maxLon-b.minLon<0.1&&
   intersects(b,{minLat:39.94,maxLat:40.05,minLon:32.56,maxLon:32.77});
 }
 function parse(record){
  if(!record||record.osm_type!=="way"||Number(record.osm_id)!==WAY_ID||
    !["water","lake","reservoir"].includes(String(record.type||"").toLowerCase()))return null;
  const geom=record.geojson;
  if(geom?.type!=="Polygon"||!Array.isArray(geom.coordinates?.[0]))return null;
  const ring=geom.coordinates[0];
  if(ring.length<4||ring.length>10000)return null;
  const valid=ring.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90);
  if(!valid||ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])return null;
  const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
  const bounds={minLat:Math.min(...ys),maxLat:Math.max(...ys),minLon:Math.min(...xs),maxLon:Math.max(...xs)};
  return {element:{type:"way",id:WAY_ID,tags:{natural:"water",name:record.name||"OSM water"},geometry:ring.map(p=>({lat:p[1],lon:p[0]}))},bounds};
 }
 async function lookup(bbox){
  if(!inArea(bbox))return null;
  const now=Date.now();
  if(cached&&now<expires)return intersects(cached.bounds,bbox)?{elements:[cached.element],source:"nominatim-osm-way"}:null;
  if(!pending){
   pending=(async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6500);
    try{
     const url=ENDPOINT+"?osm_ids=W"+WAY_ID+"&format=jsonv2&polygon_geojson=1";
     const response=await fetch(url,{method:"GET",headers:{Accept:"application/json"},signal:controller.signal,cache:"no-store"});
     if(!response.ok)return null;
     const records=await response.json();
     if(!Array.isArray(records)||records.length!==1)return null;
     return parse(records[0]);
    }catch(error){return null;}
    finally{clearTimeout(timeout);}
   })().then(value=>{cached=value;expires=Date.now()+(value?10*60*1000:90*1000);return value;}).finally(()=>{pending=null;});
  }
  const candidate=await pending;
  return candidate&&intersects(candidate.bounds,bbox)?{elements:[candidate.element],source:"nominatim-osm-way"}:null;
 }
 window.DG_OSM_WATER_BACKUP=Object.freeze({lookup});
})();
