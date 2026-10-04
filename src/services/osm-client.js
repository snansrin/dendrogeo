"use strict";
/* DendroGeo · services/osm-client.js — Overpass API istemcisi (Faz 4)
 * gridplan.js'ten birebir taşındı: ayna havuzu, 10 dk bellek cache'i,
 * sağlık/karantina takibi ve seri kuyruk (OVERPASS_BUSY zinciri).
 * Bağımlılık: park-state.js'in WATER/IMP state'ine DEĞİL, yalnız kendi
 * OVERPASS_* durumuna dokunur. */

const OVERPASS_URLS=[
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

const OVERPASS_CACHE=new Map();

const OVERPASS_HEALTH=new Map();

let OVERPASS_BUSY=Promise.resolve();
const OVERPASS_PENDING=new Map();

let LAST_OVERPASS_ERROR=null;

function overpassCacheKey(query){
  return query.replace(/\s+/g," ").trim();
}

function overpassRequest(query,label="OSM"){
  const key=overpassCacheKey(query);
  if(OVERPASS_PENDING.has(key))return OVERPASS_PENDING.get(key);
  const job=overpassRun(query,label).finally(()=>OVERPASS_PENDING.delete(key));
  OVERPASS_PENDING.set(key,job);return job;
}

async function overpassRun(query,label="OSM"){
  const key=overpassCacheKey(query);
  const cached=OVERPASS_CACHE.get(key);

  if(cached && (Date.now()-cached.time)<10*60*1000){
    console.log("✓ Overpass cache:",label);
    return cached.data;
  }

  let release=()=>{};
  // Park selection must not wait behind a slow detailed-surface request.
  const previous=label==="park"?Promise.resolve():OVERPASS_BUSY;
  if(label!=="park")OVERPASS_BUSY=new Promise(resolve=>{release=resolve;});
  await previous;

  try{
    const now=Date.now();
    const ordered=OVERPASS_URLS
      .map((url,index)=>{
        const h=OVERPASS_HEALTH.get(url)||{};
        return {url,index,badUntil:h.badUntil||0,lastOk:h.lastOk||0};
      })
      .filter(x=>x.badUntil<=now)
      .sort((x,y)=>{
        if(x.lastOk!==y.lastOk)return y.lastOk-x.lastOk;
        return x.index-y.index;
      });

    const pool=ordered.length
      ? ordered
      : OVERPASS_URLS.map((url,index)=>({url,index,badUntil:0,lastOk:0}));

    const deadline=label==="park"?Date.now()+15000:Infinity;
    for(const item of pool){
      if(Date.now()>=deadline){LAST_OVERPASS_ERROR="Park servisi bağlantı süresi aşıldı";break;}
      const controller=new AbortController();
      const timeoutMs=label==="park" ? Math.min(7500,deadline-Date.now()) : 18000;
      const timer=setTimeout(()=>controller.abort(),timeoutMs);

      try{
        console.log("→ Overpass:",label,item.url);

        const res=await fetch(item.url,{
          method:"POST",
          headers:{
            "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",
            "Accept":"application/json"
          },
          body:"data="+encodeURIComponent(query),
          signal:controller.signal,
          cache:"no-store"
        });

        if(res.ok){
          const data=await res.json();
          if(data && Array.isArray(data.elements)&&!data.remark){
            OVERPASS_CACHE.set(key,{time:Date.now(),data});
            OVERPASS_HEALTH.set(item.url,{lastOk:Date.now(),badUntil:0});
            LAST_OVERPASS_ERROR=null;
            console.log("✓ Overpass:",label,item.url,data.elements.length);
            return data;
          }
        }

        const status=res.status;
        LAST_OVERPASS_ERROR=label+" HTTP "+status+(res.ok?" · Eksik OSM yanıtı":"");
        if(status===429){
          OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+30000});
          console.warn("Overpass 429:",item.url,"→ 30 sn karantina");
          continue;
        }

        if(status===408||status===425||status>=500){
          OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+60000});
          console.warn("Overpass",status,item.url,"→ 60 sn karantina");
          continue;
        }

        const body=await res.text().catch(()=> "");
        LAST_OVERPASS_ERROR=label+" HTTP "+status+" "+body.slice(0,180);
        OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+30000});
        console.warn("Overpass hata:",LAST_OVERPASS_ERROR);
      }catch(err){
        clearTimeout(timer);
        const msg=err?.name==="AbortError" ? `timeout (${timeoutMs/1000}s)` : (err?.message||String(err));
        LAST_OVERPASS_ERROR=label+" "+msg;
        OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+60000});
        console.warn("Overpass bağlantı:",item.url,msg,"→ 60 sn karantina");
      }finally{clearTimeout(timer);}
    }
  }finally{
    release();
  }

  return null;
}
