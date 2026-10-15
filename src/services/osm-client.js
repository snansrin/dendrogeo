"use strict";
/* DendroGeo · services/osm-client.js — Overpass API istemcisi (Faz 4)
 * gridplan.js'ten birebir taşındı: ayna havuzu, 10 dk bellek cache'i,
 * sağlık/karantina takibi ve seri kuyruk (OVERPASS_BUSY zinciri).
 * Bağımlılık: park-state.js'in WATER/IMP state'ine DEĞİL, yalnız kendi
 * OVERPASS_* durumuna dokunur. */

// Global kapsamlı servisler; aynı altyapıya giden kumi takma adı kullanılmaz.
const OVERPASS_URLS=[
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

const OVERPASS_CACHE=new Map();

const OVERPASS_HEALTH=new Map();

let OVERPASS_BUSY=Promise.resolve();
const OVERPASS_PENDING=new Map();

let LAST_OVERPASS_ERROR=null;

function overpassCacheKey(query){
  if(typeof window!=="undefined"&&window.DG_OVERPASS_CACHE_KEY)return window.DG_OVERPASS_CACHE_KEY.normalize(query);
  return query.replace(/\s+/g," ").trim();
}

function overpassRequest(query,label="OSM"){
  if(typeof window!=="undefined"&&window.DG_COALESCE_OVERPASS_REQUESTS)return window.DG_COALESCE_OVERPASS_REQUESTS.request(query,label,{keyOf:overpassCacheKey,pending:OVERPASS_PENDING,run:overpassRun});
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
  const previous=Promise.resolve();
  await previous;

  try{
    const now=Date.now();
    const ordered=typeof window!=="undefined"&&window.DG_SELECT_OVERPASS_MIRRORS
      ?window.DG_SELECT_OVERPASS_MIRRORS.select(OVERPASS_URLS,OVERPASS_HEALTH,now)
      :OVERPASS_URLS
      .map((url,index)=>{
        const h=OVERPASS_HEALTH.get(url)||{};
        return {url,index,badUntil:h.badUntil||0,lastOk:h.lastOk||0};
      })
      .filter(x=>x.badUntil<=now)
      .sort((x,y)=>{
        if(x.lastOk!==y.lastOk)return y.lastOk-x.lastOk;
        return x.index-y.index;
      });

    // Karantinadaki sunuculara her yeni sorguda yeniden bağlanmayın.
    if(!ordered.length){
      LAST_OVERPASS_ERROR=label+" · OSM sunucuları geçici olarak kullanılamıyor";
      return null;
    }
    const pool=ordered;

    const deadline=typeof window!=="undefined"&&window.DG_OVERPASS_REQUEST_BUDGET
      ?window.DG_OVERPASS_REQUEST_BUDGET.deadline(label,Date.now)
      :Date.now()+(label==="park"?15000:20000);
    for(const item of pool){
      if((OVERPASS_HEALTH.get(item.url)?.badUntil||0)>Date.now())continue;
      if(Date.now()>=deadline){LAST_OVERPASS_ERROR=label+" bağlantı süresi aşıldı";break;}
      const controller=new AbortController();
      const timeoutMs=typeof window!=="undefined"&&window.DG_OVERPASS_REQUEST_BUDGET
        ?window.DG_OVERPASS_REQUEST_BUDGET.timeout(label,deadline,Date.now)
        :Math.min(label==="park"?7500:10000,deadline-Date.now());
      const timer=setTimeout(()=>controller.abort(),timeoutMs);

      try{
        console.log("→ Overpass:",label,item.url);

        if(!window.DG_POST_OVERPASS_QUERY)throw new Error("Overpass transport adapter yüklenemedi.");
        const res=await window.DG_POST_OVERPASS_QUERY.post(item.url,query,{signal:controller.signal,fetchImpl:fetch});

        if(res.ok){
          const data=await res.json();
          if(data && Array.isArray(data.elements)&&!data.remark){
            OVERPASS_CACHE.set(key,{time:Date.now(),data});
            if(typeof window!=="undefined"&&window.DG_OVERPASS_MIRROR_HEALTH)window.DG_OVERPASS_MIRROR_HEALTH.success(OVERPASS_HEALTH,item.url,Date.now);
            else OVERPASS_HEALTH.set(item.url,{lastOk:Date.now(),badUntil:0});
            LAST_OVERPASS_ERROR=null;
            console.log("✓ Overpass:",label,item.url,data.elements.length);
            return data;
          }
          LAST_OVERPASS_ERROR=label+" · "+(data?.remark||"Eksik OSM yanıtı");
          console.warn("Overpass eksik yanıt:",item.url,LAST_OVERPASS_ERROR);
          OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+60000});
          continue;
        }

        const status=res.status;
        LAST_OVERPASS_ERROR=label+" HTTP "+status+(res.ok?" · Eksik OSM yanıtı":"");
        if(status===429||status===406){
          if(typeof window!=="undefined"&&window.DG_OVERPASS_MIRROR_HEALTH)window.DG_OVERPASS_MIRROR_HEALTH.quarantine(OVERPASS_HEALTH,item.url,item.lastOk,30000,Date.now);
          else OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+30000});
          console.warn("Overpass "+status+":",item.url,"→ 30 sn karantina");
          continue;
        }

        if(status===408||status===425||status>=500){
          if(typeof window!=="undefined"&&window.DG_OVERPASS_MIRROR_HEALTH)window.DG_OVERPASS_MIRROR_HEALTH.quarantine(OVERPASS_HEALTH,item.url,item.lastOk,60000,Date.now);
          else OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+60000});
          console.warn("Overpass",status,item.url,"→ 60 sn karantina");
          continue;
        }

        const body=await res.text().catch(()=> "");
        LAST_OVERPASS_ERROR=label+" HTTP "+status+" "+body.slice(0,180);
        if(typeof window!=="undefined"&&window.DG_OVERPASS_MIRROR_HEALTH)window.DG_OVERPASS_MIRROR_HEALTH.quarantine(OVERPASS_HEALTH,item.url,item.lastOk,30000,Date.now);
        else OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+30000});
        console.warn("Overpass hata:",LAST_OVERPASS_ERROR);
      }catch(err){
        clearTimeout(timer);
        const msg=err?.name==="AbortError" ? `timeout (${timeoutMs/1000}s)` : (err?.message||String(err));
        LAST_OVERPASS_ERROR=label+" "+msg;
        // A short client park deadline does not prove the provider is unavailable.
        const quarantine=!(err?.name==="AbortError"&&(label==="park"||timeoutMs<2000));
        if(quarantine){
          if(typeof window!=="undefined"&&window.DG_OVERPASS_MIRROR_HEALTH)window.DG_OVERPASS_MIRROR_HEALTH.quarantine(OVERPASS_HEALTH,item.url,item.lastOk,60000,Date.now);
          else OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+60000});
        }
        console.warn("Overpass bağlantı:",item.url,msg,quarantine?"→ 60 sn karantina":"→ sorgu bütçesi doldu");
      }finally{clearTimeout(timer);}
    }
  }finally{
    release();
  }

  return null;
}
