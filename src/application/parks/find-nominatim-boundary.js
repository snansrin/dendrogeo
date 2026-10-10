"use strict";

/* Resolve a geocoding candidate to a verified OSM park polygon. */
window.DG_NOMINATIM_BOUNDARY_APPLICATION = {
  create({cache, fetchNominatim, areaOf, containsPoint, now = () => Date.now()}) {
    function geojsonCandidate(item) {
      if (!['way','relation'].includes(item.osm_type)||!Number.isSafeInteger(Number(item.osm_id))||Number(item.osm_id)<=0)return null;
      const geojson=item.geojson;
      const polygons=geojson?.type==='Polygon'?[geojson.coordinates]:geojson?.type==='MultiPolygon'?geojson.coordinates:null;
      if(!Array.isArray(polygons)||!polygons.length)return null;
      const rings={outer:[],inner:[]};
      for(const polygon of polygons){
        if(!Array.isArray(polygon)||!polygon.length)return null;
        for(let index=0;index<polygon.length;index++){
          const ring=polygon[index];
          if(!Array.isArray(ring)||ring.length<4||ring.some(point=>!Array.isArray(point)||point.length<2||!Number.isFinite(point[0])||!Number.isFinite(point[1])||Math.abs(point[0])>180||Math.abs(point[1])>90))return null;
          if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])return null;
          rings[index?'inner':'outer'].push(ring.map(point=>[point[1],point[0]]));
        }
      }
      const area=areaOf(rings);
      if(!(area>0))return null;
      return {name:item.name||item.display_name?.split(',')[0]||null,type:item.osm_type,id:Number(item.osm_id),rings,area,boundaryProvider:'nominatim'};
    }

    async function findBoundary(lat,lon,radius) {
      const cached=[...cache.values()]
        .filter(entry=>now()-entry.time<600000&&containsPoint(lat,lon,entry.park.rings))
        .map(entry=>entry.park);
      if(cached.length)return cached.sort((a,b)=>a.area-b.area);

      const latitudeRadius=radius/111320;
      const longitudeRadius=radius/(111320*Math.max(.1,Math.cos(lat*Math.PI/180)));
      const results=await fetchNominatim({path:'search',query:{q:'[park]',format:'jsonv2',bounded:'1',limit:'40',viewbox:[lon-longitudeRadius,lat+latitudeRadius,lon+longitudeRadius,lat-latitudeRadius].join(',')}});
      // Search extents only narrow the candidates. The returned polygon is still verified below.
      const candidates=results.filter(item=>(item.category||item.class)==='leisure'&&item.type==='park'&&['way','relation'].includes(item.osm_type)&&/^\d+$/.test(String(item.osm_id))&&Array.isArray(item.boundingbox)&&item.boundingbox.length===4&&lat>=Number(item.boundingbox[0])&&lat<=Number(item.boundingbox[1])&&lon>=Number(item.boundingbox[2])&&lon<=Number(item.boundingbox[3])).slice(0,10);
      if(!candidates.length)return [];

      const data=await fetchNominatim({path:'lookup',query:{osm_ids:candidates.map(item=>(item.osm_type==='way'?'W':'R')+item.osm_id).join(','),format:'jsonv2',polygon_geojson:'1'}});
      const allowed=new Set(candidates.map(item=>item.osm_type+'/'+item.osm_id));
      const parks=[];
      for(const item of data){
        if(!allowed.has(item.osm_type+'/'+item.osm_id))continue;
        const park=geojsonCandidate(item);
        if(park&&containsPoint(lat,lon,park.rings)){
          cache.set(park.type+'/'+park.id,{park,time:now()});
          parks.push(park);
        }
      }
      return parks.sort((a,b)=>a.area-b.area);
    }

    return Object.freeze({findBoundary,geojsonCandidate});
  }
};
