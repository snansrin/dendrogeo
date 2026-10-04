"use strict";
/* Shared Overpass client: identical requests share one result; at most two
 * mirrors are queried for a request. A delayed hedge avoids serial timeouts. */
const OVERPASS_URLS=[
 "https://lz4.overpass-api.de/api/interpreter",
 "https://overpass-api.de/api/interpreter",
 "https://overpass.private.coffee/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter",
 "https://overpass.openstreetmap.fr/api/interpreter",
 "https://z.overpass-api.de/api/interpreter"
];
const OVERPASS_CACHE=new Map(),OVERPASS_HEALTH=new Map(),OVERPASS_PENDING=new Map();
let LAST_OVERPASS_ERROR=null;
function overpassCacheKey(query){return query.replace(/\s+/g," ").trim();}
function overpassRequest(query,label="OSM"){
 const key=overpassCacheKey(query),cached=OVERPASS_CACHE.get(key);
 if(cached&&Date.now()-cached.time<600000)return Promise.resolve(cached.data);
 if(OVERPASS_PENDING.has(key))return OVERPASS_PENDING.get(key);
 const job=overpassFetch(query,label,key).finally(()=>OVERPASS_PENDING.delete(key));OVERPASS_PENDING.set(key,job);return job;
}
function overpassFetch(query,label,key){
 const now=Date.now();let preferred="";try{preferred=localStorage.getItem("dg_overpass_preferred")||"";}catch(e){}
 const ordered=OVERPASS_URLS.map((url,index)=>({url,index,...(OVERPASS_HEALTH.get(url)||{})})).filter(x=>(x.badUntil||0)<=now)
  .sort((a,b)=>(b.lastOk||0)-(a.lastOk||0)||(b.url===preferred)-(a.url===preferred)||a.index-b.index);
 // Respect quarantine even when all mirrors have failed. A later retry can
 // recover; an empty or partial response is never fabricated.
 if(!ordered.length)return Promise.resolve(null);
 return new Promise(resolve=>{
  let next=0,active=0,done=false,hedged=false;const controllers=new Set();
  const finish=data=>{if(done)return;done=true;clearTimeout(hedge);clearTimeout(deadline);for(const c of controllers)c.abort();resolve(data);};
  const launch=()=>{
   if(done||active>=2||next>=ordered.length)return;
   const item=ordered[next++],controller=new AbortController();controllers.add(controller);active++;
   const timer=setTimeout(()=>controller.abort(),label==="park"?6500:18000);
   (async()=>{try{
    const res=await fetch(item.url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",Accept:"application/json"},body:"data="+encodeURIComponent(query),signal:controller.signal,cache:"no-store"});
    if(!res.ok)throw Error("HTTP "+res.status);
    const data=await res.json();if(!Array.isArray(data?.elements)||data.remark)throw Error("Eksik veya geçersiz Overpass yanıtı");
    if(done)return;
    OVERPASS_CACHE.set(key,{time:Date.now(),data});OVERPASS_HEALTH.set(item.url,{lastOk:Date.now(),badUntil:0});LAST_OVERPASS_ERROR=null;
    try{localStorage.setItem("dg_overpass_preferred",item.url);}catch(e){}
    console.log("✓ Overpass:",label,item.url,data.elements.length);finish(data);
   }catch(e){if(!done){LAST_OVERPASS_ERROR=label+" "+(e.name==="AbortError"?"zaman aşımı":e.message);OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk||0,badUntil:Date.now()+60000});}}
   finally{clearTimeout(timer);controllers.delete(controller);active--;if(!done){launch();if(hedged)launch();if(!active&&next>=ordered.length)finish(null);}}
   })();
  };
  const hedge=setTimeout(()=>{hedged=true;launch();},750);
  const deadline=setTimeout(()=>{LAST_OVERPASS_ERROR=label+" toplam bağlantı süresi aşıldı";finish(null);},label==="park"?22000:45000);
  launch();
 });
}
