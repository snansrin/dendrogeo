#!/usr/bin/env node
/* Independent live evidence check: failure DOES NOT replace imagery with a guess.
 * One direct OSM Nominatim lookup for the known Susuz Gölü water way.
 * Runs in GIS QA, not in production page loading. */
const id=423602740,url='https://nominatim.openstreetmap.org/lookup?osm_ids=W'+id+'&format=jsonv2&polygon_geojson=1';
const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),18000);
try{
 const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':'DendroGeoGIS-QA/1.0 (https://dendrogeo.org)'},signal:ctrl.signal});
 if(!res.ok)throw Error('Nominatim HTTP '+res.status);
 const data=await res.json(),r=Array.isArray(data)?data[0]:null;
 if(!r||r.osm_type!=='way'||Number(r.osm_id)!==id||!['water','lake','reservoir'].includes(String(r.type||'').toLowerCase()))throw Error('Verified OSM water identity/tag absent');
 const geom=r.geojson,ring=geom?.type==='Polygon'?geom.coordinates?.[0]:null;
 if(!ring||ring.length<4||ring.length>10000||ring.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])))throw Error('Full polygon is absent or invalid');
 if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Water polygon not closed');
 const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
 console.log('✅ Verified current OSM water geometry',JSON.stringify({osm_id:id,vertices:ring.length,type:r.type,minLon:Math.min(...xs),maxLon:Math.max(...xs),minLat:Math.min(...ys),maxLat:Math.max(...ys)}));
}catch(e){console.error('🔴 OSM geometry cannot be verified:',e.message);process.exitCode=1;}finally{clearTimeout(timer);}
