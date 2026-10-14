"use strict";
/* Small-area read-only OSM API recovery, independent of Overpass servers. */
(function(root){
 function parse(text){
  const document=new DOMParser().parseFromString(text,"application/xml");if(document.querySelector("parsererror")||document.documentElement.nodeName!=="osm")throw Error("Geçersiz OSM XML yanıtı");
  return [...document.documentElement.children].filter(node=>["node","way","relation"].includes(node.nodeName)).map(node=>{
   const element={type:node.nodeName,id:node.getAttribute("id"),tags:{}};
   for(const child of node.children){if(child.nodeName==="tag")element.tags[child.getAttribute("k")]=child.getAttribute("v");if(child.nodeName==="nd")(element.nodes||(element.nodes=[])).push(child.getAttribute("ref"));if(child.nodeName==="member")(element.members||(element.members=[])).push({type:child.getAttribute("type"),ref:child.getAttribute("ref"),role:child.getAttribute("role")||""});}
   if(element.type==="node"){if(!node.hasAttribute("lat")||!node.hasAttribute("lon"))throw Error("OSM düğüm koordinatı eksik");element.lat=Number(node.getAttribute("lat"));element.lon=Number(node.getAttribute("lon"));}return element;
  });
 }
 function create({fetch,relevant,decode}){const cache=new Map(),pending=new Map();
  return function load(bounds){const coords=String(bounds).split(",").map(Number),[south,west,north,east]=coords,key=coords.join(",");
   if(coords.length!==4||!coords.every(Number.isFinite)||south>=north||west>=east||(north-south)*(east-west)>.005)return Promise.resolve(null);
   const saved=cache.get(key);if(saved&&Date.now()-saved.time<600000)return Promise.resolve(saved.data);if(pending.has(key))return pending.get(key);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
   const request=async path=>{const response=await fetch("https://api.openstreetmap.org/api/0.6/"+path,{headers:{Accept:"application/xml"},signal:controller.signal,cache:"no-store"});if(!response.ok)throw Error("OSM API HTTP "+response.status);return parse(await response.text());};
   const job=(async()=>{
    const initial=await request("map?bbox="+[west,south,east,north].join(",")),selected=initial.filter(relevant),index=new Map(initial.map(e=>[e.type+"/"+e.id,e]));
    const relations=selected.filter(e=>e.type==="relation");if(relations.length>16)return null;
    for(const relation of relations){
     // Native bbox responses include relation references, not all member ways.
     if((relation.members||[]).some(m=>m.type==="relation"))return null;
     const missing=(relation.members||[]).some(m=>m.type==="way"&&!index.has("way/"+m.ref));
     if(missing)for(const element of await request("relation/"+relation.id+"/full"))index.set(element.type+"/"+element.id,element);
    }
    const data={elements:decode({elements:[...index.values()],candidates:selected.map(e=>e.type+"/"+e.id)}),complete:true,source:"osm-api"};
    if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),data});return data;
   })().catch(()=>null).finally(()=>{clearTimeout(timer);pending.delete(key);});pending.set(key,job);return job;
  };
 }
 let shared=null;
 root.DG_LOAD_OSM_MAP_COVERAGE=Object.freeze({create,parse,load(bounds){if(!shared)shared=create({fetch:(...args)=>fetch(...args),relevant:root.DG_OSM_SURFACE_QUERY.relevant,decode:root.DG_DECODE_OSM_MAP_GEOMETRY.decode});return shared(bounds);}});
})(window);
