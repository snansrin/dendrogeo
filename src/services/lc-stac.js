"use strict";
/* DendroGeo · services/lc-stac.js — Planetary Computer STAC/ağ katmanı (Faz 5)
 * landcover.js'ten birebir taşındı: fetchJson, SAS imzalama, karo arama
 * (dgLcFindTiles — CORS nedeniyle GET+querystring; bkz. içindeki not ve
 * test/critical-fixes.test.mjs), yıl filtresi, asset seçimi, image meta
 * ve okuma penceresi hesabı. */

/* Retry only transient transport failures. One 30 s budget covers attempts,
 * backoff AND response decoding; cancellation is never swallowed. */
function dgLcRetryable(status){if(!window.DG_STAC_FETCH_POLICY)throw new Error("STAC fetch adapter yüklenemedi.");return window.DG_STAC_FETCH_POLICY.retryable(status);}
function dgLcRetryWait(attempt,signal,response){if(!window.DG_STAC_FETCH_POLICY)throw new Error("STAC fetch adapter yüklenemedi.");return window.DG_STAC_FETCH_POLICY.retryWait(attempt,signal,response);}
async function dgLcFetchJson(url,options){
 if(!window.DG_STAC_FETCH_POLICY)throw new Error("STAC fetch adapter yüklenemedi.");
 return window.DG_STAC_FETCH_POLICY.fetchJson(url,options,fetch);
}

/* Bound every HTTP range, including image-directory reads which GeoTIFF 2.1
 * does not pass a readRasters signal to. Keep Range headers and COG semantics. */
function dgLcOpenRaster(href,sourceSignal){
 if(!window.DG_OPEN_RASTER_RANGE_ADAPTER)throw new Error("COG range adapter yüklenemedi.");
 return window.DG_OPEN_RASTER_RANGE_ADAPTER.open(href,sourceSignal,{GeoTIFF,fetchImpl:fetch,retryable:dgLcRetryable,retryWait:dgLcRetryWait});
}

function dgLcSignedHref(href,token){
  if(typeof window!=="undefined"&&window.DG_SIGN_STAC_ASSETS)return window.DG_SIGN_STAC_ASSETS.signedHref(href,token);
  if(!token)return href;
  const t=String(token).replace(/^[?&]/,"");
  if(!t)return href;
  return href+(href.includes("?")?"&":"?")+t;
}

/* Kaynak yıla ait karo listesini getirir.
 *
 * ⚠️ YIL FİLTRESİ NEDEN HAYATİ: STAC `datetime` aralığı io-lulc koleksiyonunda
 * 2020 sorgusuna 2019 karolarını DA döndürebiliyordu (item datetime alanı
 * ürün takvimiyle birebir eşleşmiyor). Filtre yoksa iki karo işlenip
 * alanlar TOPLANIYOR ve assigned ≈ 2× park alanı oluyordu — sahadaki
 * "QA başarısız: %99.61 fark" hatasının kökü buydu. Sorgudan dönen her item
 * bu yüzden id ve properties üzerinden yıla göre süzülür. */
function dgLcItemMatchesYear(item,year){
  if(typeof window!=="undefined"&&window.DG_SELECT_STAC_TILES)return window.DG_SELECT_STAC_TILES.matchesYear(item,year);
  const id=String(item?.id||"");
  if(id.endsWith("-"+year)||id.includes("_"+year+"_")||id.includes("/"+year+"/"))return true;
  const p=item?.properties||{};
  const dt=String(p.datetime||p.start_datetime||"");
  if(dt.slice(0,4)===String(year))return true;
  // io-lulc id biçimi: "36S-2020"
  const m=id.match(/(19|20)\d{2}/);
  if(m&&Number(m[0])===year)return true;
  return false;
}

async function dgLcFindTiles(bbox,source,signal){
  if(typeof window!=="undefined"&&window.DG_SELECT_STAC_TILES)return window.DG_SELECT_STAC_TILES.findTiles(bbox,source,signal,{sources:DG_LC_SOURCES,stac:DG_LC_STAC,maxTiles:DG_LC_MAX_TILES,fetchJson:dgLcFetchJson,itemMatchesYear:dgLcItemMatchesYear});
  const src=source||DG_LC_SOURCES.cross;
  /* ⚠️ CORS: POST + application/json tarayıcıda preflight (OPTIONS) tetikler ve
   * Planetary Computer /search OPTIONS isteğine 405 döner → analiz daha ilk
   * adımda ölür (Node harness'ında CORS olmadığı için testler bunu YAKALAMAZ).
   * GET + querystring "simple request"tir: preflight yok, yanıt ACAO:* ile
   * gelir (2026-09-24 canlı doğrulandı). Bu yüzden arama daima GET'tir. */
  const qs=new URLSearchParams({
    collections:src.collection,
    bbox:[bbox.minLon,bbox.minLat,bbox.maxLon,bbox.maxLat].join(","),
    datetime:src.year+"-01-01T00:00:00Z/"+src.year+"-12-31T23:59:59Z",
    limit:String(DG_LC_MAX_TILES)
  });
  const data=await dgLcFetchJson(DG_LC_STAC+"/search?"+qs.toString(),{
    headers:{Accept:"application/geo+json"},signal
  });
  const ham=Array.isArray(data?.features)?data.features:[];
  const items=ham.filter(it=>dgLcItemMatchesYear(it,src.year));
  if(!items.length)throw new Error(
    src.label+" için parkla kesişen "+src.year+" veri karosu bulunamadı."+
    (ham.length?" ("+ham.length+" karo döndü ama hiçbiri "+src.year+" değil — yıl filtresi reddetti)":"")
  );
  return items;
}

const DG_LC_SAS_CACHE=new Map();
async function dgLcGetSas(collection,signal){
  if(typeof window!=="undefined"&&window.DG_SIGN_STAC_ASSETS)return window.DG_SIGN_STAC_ASSETS.getSas(collection,signal,{cache:DG_LC_SAS_CACHE,defaultCollection:DG_LC_SOURCES.cross.collection,sasEndpoint:DG_LC_SAS,fetchJson:dgLcFetchJson});
  const coll=collection||DG_LC_SOURCES.cross.collection;
  if(signal?.aborted)throw Object.assign(new Error("İstek iptal edildi."),{name:"AbortError"});
  const cached=DG_LC_SAS_CACHE.get(coll);
  if(cached&&cached.expires>Date.now()+120000)return cached.token;
  DG_LC_SAS_CACHE.delete(coll);
  try{
    const data=await dgLcFetchJson(DG_LC_SAS+coll,{headers:{Accept:"application/json"},signal});
    const token=data?.token||"";
    const expiry=Date.parse(data?.msftExpiry||new URLSearchParams(String(token).replace(/^\?/,"")).get("se"));
    if(token&&Number.isFinite(expiry)&&expiry>Date.now()+120000){
     if(DG_LC_SAS_CACHE.size>=8)DG_LC_SAS_CACHE.delete(DG_LC_SAS_CACHE.keys().next().value);
     DG_LC_SAS_CACHE.set(coll,{token,expires:expiry});
    }
    return token;
  }catch(err){
    if(signal?.aborted||err.name==="AbortError")throw err;
    console.warn("DENDROGEO · Veri imzalama tokenı alınamadı; doğrudan açık asset deneniyor.",err);
    return"";
  }
}

function dgLcGetDataAsset(item,source){
  if(typeof window!=="undefined"&&window.DG_SELECT_STAC_TILES)return window.DG_SELECT_STAC_TILES.getDataAsset(item,source);
  const a=item?.assets||{};
  const keys=(source&&source.assetKeys)||["data","lulc","map"];
  for(const k of keys)if(a[k]?.href)return a[k];
  return Object.values(a).find(v=>
    v&&String(v.type||"").toLowerCase().includes("geotiff")&&v.href
  )||null;
}

function dgLcImageMeta(image){
  if(typeof window!=="undefined"&&window.DG_RESOLVE_RASTER_WINDOW)return window.DG_RESOLVE_RASTER_WINDOW.imageMeta(image);
  const bbox=image.getBoundingBox();
  const width=image.getWidth();
  const height=image.getHeight();
  if(!Array.isArray(bbox)||bbox.length!==4)throw new Error("COG uzamsal sınır metadatası okunamadı.");
  return{
    minX:Number(bbox[0]),
    minY:Number(bbox[1]),
    maxX:Number(bbox[2]),
    maxY:Number(bbox[3]),
    width,
    height,
    dx:(Number(bbox[2])-Number(bbox[0]))/width,
    dy:(Number(bbox[3])-Number(bbox[1]))/height
  };
}

function dgLcWindowForPark(meta,parkBBox){
  if(typeof window!=="undefined"&&window.DG_RESOLVE_RASTER_WINDOW)return window.DG_RESOLVE_RASTER_WINDOW.windowForPark(meta,parkBBox);
  const minCol=Math.max(0,
    Math.floor((parkBBox.minX-meta.minX)/meta.dx)-1);
  const maxCol=Math.min(meta.width,
    Math.ceil((parkBBox.maxX-meta.minX)/meta.dx)+1);
  const minRow=Math.max(0,
    Math.floor((meta.maxY-parkBBox.maxY)/meta.dy)-1);
  const maxRow=Math.min(meta.height,
    Math.ceil((meta.maxY-parkBBox.minY)/meta.dy)+1);

  if(maxCol<=minCol||maxRow<=minRow)throw new Error("Park ile 10 m veri karosu arasında piksel kesişimi yok.");
  return[minCol,minRow,maxCol,maxRow];
}
