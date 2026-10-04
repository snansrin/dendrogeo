"use strict";
/* DendroGeo · services/lc-stac.js — Planetary Computer STAC/ağ katmanı (Faz 5)
 * landcover.js'ten birebir taşındı: fetchJson, SAS imzalama, karo arama
 * (dgLcFindTiles — CORS nedeniyle GET+querystring; bkz. içindeki not ve
 * test/critical-fixes.test.mjs), yıl filtresi, asset seçimi, image meta
 * ve okuma penceresi hesabı. */

function dgLcFetchJson(url,options){
  return fetch(url,Object.assign({
    cache:"no-store",
    headers:{Accept:"application/json"}
  },options||{})).then(async res=>{
    if(!res.ok){
      const txt=await res.text().catch(()=> "");
      throw new Error("HTTP "+res.status+" · "+txt.slice(0,180));
    }
    return res.json();
  });
}

function dgLcSignedHref(href,token){
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

async function dgLcFindTiles(bbox,source){
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
    headers:{Accept:"application/geo+json"}
  });
  const ham=Array.isArray(data?.features)?data.features:[];
  const items=ham.filter(it=>dgLcItemMatchesYear(it,src.year));
  if(!items.length)throw new Error(
    src.label+" için parkla kesişen "+src.year+" veri karosu bulunamadı."+
    (ham.length?" ("+ham.length+" karo döndü ama hiçbiri "+src.year+" değil — yıl filtresi reddetti)":"")
  );
  return items;
}

async function dgLcGetSas(collection){
  const coll=collection||DG_LC_SOURCES.cross.collection;
  try{
    const data=await dgLcFetchJson(DG_LC_SAS+coll,{headers:{Accept:"application/json"}});
    return data?.token||"";
  }catch(err){
    console.warn("DENDROGEO · Veri imzalama tokenı alınamadı; doğrudan açık asset deneniyor.",err);
    return"";
  }
}

function dgLcGetDataAsset(item,source){
  const a=item?.assets||{};
  const keys=(source&&source.assetKeys)||["data","lulc","map"];
  for(const k of keys)if(a[k]?.href)return a[k];
  return Object.values(a).find(v=>
    v&&String(v.type||"").toLowerCase().includes("geotiff")&&v.href
  )||null;
}

function dgLcImageMeta(image){
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
