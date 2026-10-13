"use strict";
/* DendroGeo · services/lc-s2.js — SENTINEL-2 SPEKTRAL ÇAPRAZ KANIT (Çalışma Sahası v5)
 *
 * AMAÇ: LULC sınıflandırmasından BAĞIMSIZ ikinci bir otomatik kanıt hattı.
 * Microsoft Planetary Computer üzerinden erişilen Copernicus Sentinel-2 L2A
 * sahnelerinden (10 m, atmosferik düzeltmeli). Veri kullanımı Copernicus'un
 * serbest, tam ve açık veri politikası ile kaynak bildirimine tabidir; bu veri
 * CC BY 4.0 lisanslı olarak tanımlanmamalıdır. Parkın referans dönemi için bulutsuz medyan
 * kompozit üretir; her 10 m WorldCover hücresinde NDVI/MNDWI/NDBI hesaplar.
 *
 * NEDEN MEDYAN KOMPOZİT: tek sahne bulut/gölge/kalıcı iz taşır; medyan
 * kompozit aykırı gözlemleri bastırır (çok zamanlı en-iyi piksel ailesinin
 * basit ve robust üyesi). Hücre başına ≥3 geçerli gözlem şartı (lc-validate
 * MIN_OBS) az sayıda kalan sahnelerin gürültüsünü keser.
 *
 * BULUT MASKESİ: SCL (Scene Classification Layer, 20 m) — geçerli sınıflar
 * {2 koyu alan, 4 vejetasyon, 5 çıplak, 6 su, 7 sınıflanmamış/düşük bulut
 * olasılığı}; maskelenenler {0 nodata, 1 doygun, 3 bulut gölgesi, 8-9 bulut,
 * 10 ince sirrus, 11 kar}. (Sentinel-2 L2A ATBD, SCL tanım tablosu.)
 *
 * CORS DERSİ (lc-stac.js'ten miras): STAC araması daima GET+querystring —
 * POST preflight'i Planetary Computer'da 405. İmzalama dgLcGetSas(collection).
 *
 * Güncel yıl seçeneği: içinde bulunulan yılın 1 Ocak–bugün aralığı.
 * 2021 WorldCover ile dönem farkı açıkça raporlanır; güncel spektral profil
 * ham 2021 raster sınıflarını kendiliğinden değiştirmez. Tarih uyumlu geçmiş
 * kontrol için 2021 ve kısa dönem değişim taraması ayrıca seçilebilir.
 *
 * YÜKLEME SIRASI: lc-stac (dgLcFetchJson/dgLcGetSas/dgLcSignedHref/
 * dgLcImageMeta) ve lc-geo (dgLcUtmForward/dgLcUtmEpsgForLatLon) ÖNCE
 * yüklenmiş olmalı; GeoTIFF çağrı anında dgEnsureGeoTIFF ile tembel. */

const DG_S2_COLLECTION="sentinel-2-l2a";
const DG_S2_MAX_SCENES=6;      /* mobil veri bütçesi: 6 sahne × 5 asset pencere okuması */
const DG_S2_MAX_CLOUD=20;      /* eo:cloud_cover üst sınırı (%) */
const DG_S2_SEARCH_LIMIT=60;   /* istemci tarafı bulut sıralaması için havuz */
/* Bantlar: B03 yeşil, B04 kırmızı, B08 NIR (10 m); B11 SWIR1, SCL (20 m).
 * MNDWI SWIR1 ister (Xu 2006); NDBI SWIR1-NIR; NDVI NIR-kırmızı. */
const DG_S2_BANDS={B03:10,B04:10,B08:10,B11:20,SCL:20};
/* SCL geçerli sınıflar (yukarıdaki gerekçe) */
const DG_S2_SCL_VALID=[2,4,5,6,7];
const DG_S2_SCALE=10000;       /* L2A yansıma ölçeği */

/* Referans dönemi seçenekleri (karne beyanı bunları kaynak gösterir) */
function dgS2SeasonRange(year,mode){
  if(window.DG_SENTINEL_TEMPORAL_WINDOWS)return window.DG_SENTINEL_TEMPORAL_WINDOWS.seasonRange(year,mode);
  const y=Number(year)||2021;
  if(mode==="ytd"){
    const now=new Date(),currentYear=now.getUTCFullYear(),end=now.toISOString();
    const start=new Date(Date.UTC(currentYear,0,1)).toISOString();
    return{start,end,label:currentYear+" güncel yıl (1 Oca – "+end.slice(0,10)+")"};
  }
  if(mode==="latest"){
    const now=new Date(),end=now.toISOString(),start=new Date(now.getTime()-120*86400000).toISOString();
    return{start,end,label:start.slice(0,10)+" – "+end.slice(0,10)+" (güncel, son 120 gün)"};
  }
  return{start:y+"-06-01T00:00:00Z",end:y+"-09-30T23:59:59Z",label:y+" vejetasyon sezonu (1 Haz – 30 Eyl)"};
}

/* STAC sahne araması: GET (CORS dersi) → bulutsuz sahneler → en güncel farklı tarihleri seç */
async function dgS2FindScenesRange(bbox,start,end,maxN){
  if(window.DG_SELECT_SENTINEL_SCENES)return window.DG_SELECT_SENTINEL_SCENES.findRange(bbox,start,end,maxN,{collection:DG_S2_COLLECTION,searchLimit:DG_S2_SEARCH_LIMIT,maxCloud:DG_S2_MAX_CLOUD,bands:DG_S2_BANDS,fetchJson:dgLcFetchJson,selectScenes:dgS2SelectScenes});
  const qs=new URLSearchParams({
    collections:DG_S2_COLLECTION,
    bbox:[bbox.minLon,bbox.minLat,bbox.maxLon,bbox.maxLat].join(","),
    datetime:start+"/"+end,
    limit:String(DG_S2_SEARCH_LIMIT),
    sortby:"-datetime"
  });
  const data=await dgLcFetchJson(DG_LC_STAC+"/search?"+qs.toString(),{
    headers:{Accept:"application/geo+json"}
  });
  const items=Array.isArray(data&&data.features)?data.features:[];
  const unique=new Set();
  const candidates=items
    .map(it=>({it,cloud:Number((it.properties&&it.properties["eo:cloud_cover"])??101)}))
    .filter(x=>x.cloud<=DG_S2_MAX_CLOUD&&Object.keys(DG_S2_BANDS).every(b=>x.it.assets?.[b]?.href))
    .sort((a,b)=>a.cloud-b.cloud||String(b.it.properties.datetime).localeCompare(String(a.it.properties.datetime)))
    .filter(x=>{const p=x.it.properties||{},key=String(p["s2:mgrs_tile"]||p["grid:code"]||"")+":"+String(p.datetime).slice(0,10);if(unique.has(key))return false;unique.add(key);return true;});
  // Cover the season instead of using only its last few dates. Reserve one
  // candidate per tile before filling remaining slots by temporal distance.
  const ranked=dgS2SelectScenes(candidates,maxN||DG_S2_MAX_SCENES);
  return ranked.map(x=>({
    id:x.it.id,
    item:x.it,
    cloud:+x.cloud.toFixed(1),
    datetime:String((x.it.properties&&(x.it.properties.datetime||x.it.properties.sentinel_product_id))||x.it.id).slice(0,10)
  }));
}

function dgS2SelectScenes(candidates,maxN){
 if(window.DG_SELECT_SENTINEL_SCENES)return window.DG_SELECT_SENTINEL_SCENES.select(candidates,maxN);
 const pending=candidates.slice(),selected=[];
 const tile=x=>String(x.it.properties?.["s2:mgrs_tile"]||x.it.properties?.["grid:code"]||"");
 const day=x=>Date.parse(String(x.it.properties?.datetime||"").slice(0,10));
 while(pending.length&&selected.length<maxN){
  const seen=new Set(selected.map(tile));
  let pool=pending.filter(x=>!seen.has(tile(x)));
  if(!pool.length)pool=pending;
  const distance=x=>{const peers=selected.filter(y=>tile(y)===tile(x));return peers.length?Math.min(...peers.map(y=>Math.abs(day(x)-day(y)))):Infinity;};
  pool.sort((a,b)=>{const da=distance(a),db=distance(b);return (da===db?0:db-da)||a.cloud-b.cloud||day(b)-day(a);});
  const best=pool[0];selected.push(best);pending.splice(pending.indexOf(best),1);
 }
 return selected;
}

async function dgS2FindScenes(bbox,year,mode){
  const range=dgS2SeasonRange(year,mode);
  const scenes=await dgS2FindScenesRange(bbox,range.start,range.end,DG_S2_MAX_SCENES);
  if(!scenes.length)throw new Error(
    "Sentinel-2: referans döneminde ("+range.label+") %"+DG_S2_MAX_CLOUD+
    " altı bulutlulukta sahne bulunamadı. Dönemi genişletin veya 'güncel sezon'u deneyin."
  );
  return{scenes,range};
}

/* SU KALICILIĞI PENCERELERİ (WorldCover sınıf 80 semantiği: "yılın çoğunda
 * su"). Yaz medyanı mevsimsel çekilen göl kıyılarını kurak görür (Göksü canlı
 * dersi 2026-10-03: su hücrelerinde p25 MNDWI = 0.006, ✗612). Bu yüzden su
 * kanıtı için yüksek su dönemi (ilkbahar) + sonbahar pencereleri ayrıca
 * taranır; MAX MNDWI "referans yılında açık su görüldü mü" sorusuna döner. */
function dgS2WaterWindows(year,mode,nowOverride){
  if(window.DG_SENTINEL_TEMPORAL_WINDOWS)return window.DG_SENTINEL_TEMPORAL_WINDOWS.waterWindows(year,mode,nowOverride);
  /* Güncel modlarda kalıcılık pencereleri de seçilen güncel yılı kullanır. */
  const now=nowOverride!=null?new Date(nowOverride):new Date();
  const y=(mode==="latest"||mode==="ytd")?now.getUTCFullYear():(Number(year)||2021);
  const windows=[
    {start:y+"-02-01T00:00:00Z",end:y+"-05-31T23:59:59Z",max:3,label:y+" ilkbahar (yüksek su)"},
    {start:y+"-10-01T00:00:00Z",end:y+"-12-15T23:59:59Z",max:2,label:y+" sonbahar"}
  ];
  if(mode!=="ytd")return windows;
  return windows.flatMap(w=>{
    const start=Date.parse(w.start),end=Math.min(Date.parse(w.end),now.getTime());
    return end<start?[]:[{...w,end:new Date(end).toISOString()}];
  });
}

/* Bir sahnenin tek bandı için pencere okuması.
 *
 * ⚠ EPSG DİSİPLİNİ (lc-engine'deki 4326/UTM dersinin Sentinel-2 şubesi):
 * S2 COG'ları KENDİ UTM bölgesindedir (proj:epsg). Park bölge sınırına
 * yakınsa analiz EPSG'si ile sahne EPSG'si FARKLI olabilir; pencere bu
 * yüzden her görüntüde KENDİ epsg'sine projekte edilen bbox'tan hesaplanır.
 * Aynı disiplin hücre merkezi indekslemede de uygulanır (dgS2CellIndexXY). */
async function dgS2ReadBand(image,bboxDeg){
  if(window.DG_SENTINEL_RASTER_GRID)return window.DG_SENTINEL_RASTER_GRID.readBand(image,bboxDeg,{getMeta:dgLcImageMeta,windowFor:dgLcWindowForPark,project:dgLcUtmForward});
  const epsg=dgS2AssetEpsg(image);
  const meta=dgLcImageMeta(image);
  const win=dgLcWindowForPark(meta,dgS2UtmBBox(bboxDeg,epsg));
  const values=await image.readRasters({window:win,samples:[0],interleave:true});
  return{meta,win,values,epsg};
}

function dgS2UtmBBox(bboxDeg,epsg){
  if(window.DG_SENTINEL_RASTER_GRID)return window.DG_SENTINEL_RASTER_GRID.utmBbox(bboxDeg,epsg,dgLcUtmForward);
  /* Derece bbox → verilen UTM bölgesinde köşe izdüşümlerinin zarfı */
  const corners=[
    [bboxDeg.minLat,bboxDeg.minLon],[bboxDeg.minLat,bboxDeg.maxLon],
    [bboxDeg.maxLat,bboxDeg.minLon],[bboxDeg.maxLat,bboxDeg.maxLon]
  ];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const c of corners){
    const z=dgLcUtmForward(c[0],c[1],epsg);
    minX=Math.min(minX,z.x);maxX=Math.max(maxX,z.x);
    minY=Math.min(minY,z.y);maxY=Math.max(maxY,z.y);
  }
  return{minX,minY,maxX,maxY};
}

/* Hücre merkezi (lat/lon) → bant penceresinde satır/sütun. Bant çözünürlüğü
 * farklı olabilir (10/20 m): meta dx/dy kendi çözünürlüğündedir. */
function dgS2CellIndex(meta,win,x,y){
  if(window.DG_SENTINEL_RASTER_GRID)return window.DG_SENTINEL_RASTER_GRID.cellIndex(meta,win,x,y);
  const col=Math.floor((x-meta.minX)/meta.dx);
  const row=Math.floor((meta.maxY-y)/meta.dy);
  const lc=col-win[0],lr=row-win[1];
  const w=win[2]-win[0],h=win[3]-win[1];
  if(lc<0||lr<0||lc>=w||lr>=h)return null;
  return lr*w+lc;
}

function dgS2Median(arr){
  if(window.DG_SENTINEL_SPECTRAL_EVIDENCE)return window.DG_SENTINEL_SPECTRAL_EVIDENCE.median(arr);
  if(!arr.length)return null;
  const s=arr.slice().sort((a,b)=>a-b);
  const m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}

/* Two independent acquisition days must support a seasonal extreme. A single
 * residual cloud, shadow or wet pavement observation cannot drive the review. */
function dgS2ConfirmedExtreme(values){
 if(window.DG_SENTINEL_SPECTRAL_EVIDENCE)return window.DG_SENTINEL_SPECTRAL_EVIDENCE.confirmedExtreme(values);
 const sorted=values.filter(Number.isFinite).sort((a,b)=>b-a);
 return sorted.length>=2?sorted[1]:null;
}

function dgS2VegetationSummary(evidence){
 if(window.DG_SENTINEL_SPECTRAL_EVIDENCE)return window.DG_SENTINEL_SPECTRAL_EVIDENCE.vegetationSummary(evidence);
 const dates=evidence?.dates instanceof Set?evidence.dates:new Set(evidence?.dates||[]);
 return{ndviMedianYear:dgS2Median(evidence?.ndvi||[]),ndviObs:dates.size};
}

/* Planetary Computer baseline-change notebook + ESA PB04 radiometry.
 * DN=0 remains NoData. Asset scale/offset metadata takes precedence. */
function dgS2Reflectance(raw,item,band){
 if(window.DG_SENTINEL_SPECTRAL_EVIDENCE)return window.DG_SENTINEL_SPECTRAL_EVIDENCE.reflectance(raw,item,band,DG_S2_SCALE);
 const v=Number(raw);if(!Number.isFinite(v)||v<=0||v>=65535)return null;
 const asset=item?.assets?.[band],meta=asset?.["raster:bands"]?.[0];
 const baseline=Number(item?.properties?.["s2:processing_baseline"]);
 const date=String(item?.properties?.datetime||"");
 const offset=Number.isFinite(meta?.offset)?meta.offset:((Number.isFinite(baseline)?baseline>=4:date>="2022-01-25")?-1000:0);
 const r=Number.isFinite(meta?.scale)?v*meta.scale+(Number.isFinite(meta?.offset)?meta.offset:0):(v+offset)/DG_S2_SCALE;
 return Number.isFinite(r)&&r>=-0.1&&r<=1.6?Math.max(0,r):null;
}
/* ANA GİRİŞ: hücre listesi (dgLcAnalyze → result.cells) için spektral profil.
 * Dönüş: {cells:{"row:col":{b03,b04,b08,b11,ndvi,mndwi,ndbi,obs}},
 *         scenes:[{id,cloud,datetime}], epsg, range, skipped}
 * Ağır iş: her sahne için 5 asset açılır, park penceresi okunur; hücre
 * başına geçerli gözlemler toplanır, sahneler bitince medyan + indeksler. */
async function dgS2Profile(cells,outer,opts){
  if(window.dgEnsureGeoTIFF)await window.dgEnsureGeoTIFF();
  if(!window.GeoTIFF)throw new Error("GeoTIFF okuyucu yüklenmedi.");
  const o=opts||{};
  if(!cells||!cells.length)throw new Error("Spektral tarama için hücre listesi yok (önce arazi örtüsü analizi).");

  const lats=cells.map(c=>c.center.lat),lons=cells.map(c=>c.center.lon);
  const bbox={
    minLat:Math.min(...lats),maxLat:Math.max(...lats),
    minLon:Math.min(...lons),maxLon:Math.max(...lons)
  };
  /* bbox'ı yarım hücre (~0.00005°) genişlet: kenar hücreleri pencere dışında kalmasın */
  bbox.minLat-=0.0002;bbox.maxLat+=0.0002;bbox.minLon-=0.0003;bbox.maxLon+=0.0003;

  const epsg=o.epsg||dgLcUtmEpsgForLatLon(lats[0],lons[0]);
  const found=await dgS2FindScenes(bbox,o.year||2021,o.mode);
  if(found.scenes.length<DG_S2_MIN_OBS_GUARD)throw Error("En az 3 farklı tarihte bulutsuz sahne gerekiyor; yeterli güncel veri bulunamadı.");
  const token=await dgLcGetSas(DG_S2_COLLECTION);
  const bboxDeg=bbox;

  const acc={};   /* key → bands + distinct acquisition days */
  const skipped=[];
  for(const sc of found.scenes){
    try{
      const images=await window.DG_LOAD_SENTINEL_SCENE_BANDS.load({scene:sc,token,bands:Object.keys(DG_S2_BANDS),signHref:dgLcSignedHref,openRaster:dgLcOpenRaster});
      /* SCL first: its 20 m grid masks every spectral band observation. */
      const reads=await window.DG_READ_SENTINEL_SCENE_WINDOWS.read({images,bands:["SCL","B03","B04","B08","B11"],bbox:bboxDeg,readBand:dgS2ReadBand});
      /* Each cell center is indexed in each band's own UTM window. */
      const indices=window.DG_INDEX_SENTINEL_SCENE_CELLS.build({cells,bands:reads,project:dgLcUtmForward,indexFor:dgS2CellIndex});
      const used=window.DG_COLLECT_SENTINEL_SCENE_OBSERVATIONS.collect({cells,scl:reads.SCL,bands:reads,indices,validClasses:DG_S2_SCL_VALID,item:sc.item,datetime:sc.datetime,reflectance:dgS2Reflectance,accumulator:acc});
      sc.usedCells=used;
    }catch(err){
      skipped.push({id:sc.id,reason:String(err&&err.message||err).slice(0,160)});
      console.warn("DENDROGEO · Sentinel-2 sahnesi atlandı:",sc.id,String(err&&err.message||err).slice(0,120));
    }
  }

  /* Medyan kompozit + indeksler */
  let out={},nOk=0,evidence;
  if(window.DG_BUILD_SENTINEL_PROFILE){const initial=window.DG_BUILD_SENTINEL_PROFILE.initial(acc,DG_S2_MIN_OBS_GUARD,{median:dgS2Median,confirmedExtreme:dgS2ConfirmedExtreme});out=initial.out;evidence=initial.evidence;nOk=initial.nProfiled;}
  else{
  out={};
  nOk=0;
  for(const key of Object.keys(acc)){
    const a=acc[key];
    const obs=Math.min(a.b03.length,a.b04.length,a.b08.length,a.b11.length);
    const g=dgS2Median(a.b03),r=dgS2Median(a.b04),nir=dgS2Median(a.b08),sw=dgS2Median(a.b11);
    if(obs<DG_S2_MIN_OBS_GUARD||g===null||r===null||nir===null||sw===null){out[key]={obs,predict:"nodata"};continue;}
    if(nir+r<=0||g+sw<=0||sw+nir<=0){out[key]={obs,predict:"nodata"};continue;}
    // Median of actual, simultaneous spectral observations. Separate band
    // medians can synthesize a spectrum that never occurred on any date.
    const ndvi=dgS2Median(a.ndvis);
    const mndwi=dgS2Median(a.mndwis);
    const ndbi=dgS2Median(a.ndbis);
    const mndwiMax=a.mndwis&&a.mndwis.length?Math.max(...a.mndwis):mndwi;
    const ndviMax=a.ndvis&&a.ndvis.length?Math.max(...a.ndvis):ndvi;
    out[key]={
      obs,
      ndviConfirmed:dgS2ConfirmedExtreme(a.ndvis),mndwiConfirmed:dgS2ConfirmedExtreme(a.mndwis),
      b03:+g.toFixed(4),b04:+r.toFixed(4),b08:+nir.toFixed(4),b11:+sw.toFixed(4),
      ndvi:+ndvi.toFixed(4),mndwi:+mndwi.toFixed(4),ndbi:+ndbi.toFixed(4),
      mndwiMax:+mndwiMax.toFixed(4),ndviMax:+ndviMax.toFixed(4)
    };
    nOk++;
  }
  }

  /* ═══ MEVSİMSEL KALICILIK TARAMASI (WorldCover sınıf semantiği) ═══
   * WorldCover sınıfları YIL BOYU kalıcılığı haritalar; yaz medyanı tek
   * başına iki canlı dersle çelişti (2026-10-03):
   *  · GÖKSU (park 25): mevsimsel çekilen göl kıyısı — yaz medyanı suyun
   *    %32'sini kurak gördü (yıllık MAX MNDWI gerekti).
   *  · DOĞAL YAŞAM (park 5): Anadolu kuru step çayırı — ağustosta NDVI
   *    0.24, IBI pozitif → "sert zemin" sanıldı; oysa bahar yeşillenmesi
   *    (ndviMax ≥ 0.5) sınıf 30 kanıtıdır. Kuru parlak toprak (sınıf 60)
   *    ile asfaltı ayıran da YIL BOYU vejetasyon yokluğu/yokluğu:
   *    toprak baharda yeşerir (ndviMaxYear ≥ 0.25), asfalt asla.
   * İlkbahar (şub-may) + sonbahar (eki-ara) pencerelerinde 5 asset okunur;
   * hücre başına YILLIK MAX MNDWI ve MAX NDVI üretilir. */
  const waterMax={},vegMax={};
  if(!evidence){evidence={};for(const key of Object.keys(acc))evidence[key]={ndvi:acc[key].ndvis.slice(),mndwi:acc[key].mndwis.slice(),dates:new Set(acc[key].dates)};}
  const waterScenes=[];
  if(o.waterYear!==false&&o.mode!=="latest"){
    for(const w of dgS2WaterWindows(o.year||2021,o.mode)){
      let wScenes=[];
      try{wScenes=await dgS2FindScenesRange(bbox,w.start,w.end,w.max);}catch(err){wScenes=[];}
      for(const sc of wScenes){
        try{
          const assets=sc.item.assets||{};
          const hrefFor=n2=>{const a2=assets[n2];return a2&&a2.href?dgLcSignedHref(a2.href,token):null;};
          const hB03=hrefFor("B03"),hB04=hrefFor("B04"),hB08=hrefFor("B08"),hB11=hrefFor("B11"),hSCL=hrefFor("SCL");
          if(!hB03||!hB04||!hB08||!hB11||!hSCL)continue;
          const imgs=await Promise.all([
            dgLcOpenRaster(hB03).then(t=>t.getImage()),
            dgLcOpenRaster(hB04).then(t=>t.getImage()),
            dgLcOpenRaster(hB08).then(t=>t.getImage()),
            dgLcOpenRaster(hB11).then(t=>t.getImage()),
            dgLcOpenRaster(hSCL).then(t=>t.getImage())
          ]);
          const rSCL=await dgS2ReadBand(imgs[4],bboxDeg);
          const rB03=await dgS2ReadBand(imgs[0],bboxDeg);
          const rB04=await dgS2ReadBand(imgs[1],bboxDeg);
          const rB08=await dgS2ReadBand(imgs[2],bboxDeg);
          const rB11=await dgS2ReadBand(imgs[3],bboxDeg);
          const idxOf=band=>cells.map(c=>{
            const z=dgLcUtmForward(c.center.lat,c.center.lon,band.epsg);
            return dgS2CellIndex(band.meta,band.win,z.x,z.y);
          });
          const iS=idxOf(rSCL),i3=idxOf(rB03),i4=idxOf(rB04),i8=idxOf(rB08),i1=idxOf(rB11);
          let usedW=0;
          for(let ci=0;ci<cells.length;ci++){
            if(iS[ci]===null||i3[ci]===null||i4[ci]===null||i8[ci]===null||i1[ci]===null)continue;
            if(!DG_S2_SCL_VALID.includes(Math.round(Number(rSCL.values[iS[ci]]))))continue;
            const gW=dgS2Reflectance(rB03.values[i3[ci]],sc.item,"B03"),rW=dgS2Reflectance(rB04.values[i4[ci]],sc.item,"B04");
            const nW=dgS2Reflectance(rB08.values[i8[ci]],sc.item,"B08"),sW=dgS2Reflectance(rB11.values[i1[ci]],sc.item,"B11");
            const okB=v=>v!==null&&Number.isFinite(v);
            if(!okB(gW)||!okB(rW)||!okB(nW)||!okB(sW)||gW+sW<=0||nW+rW<=0)continue;
            const kW=cells[ci].row+":"+cells[ci].col;
            if(!evidence[kW])evidence[kW]={ndvi:[],mndwi:[],dates:new Set()};
            if(evidence[kW].dates.has(sc.datetime))continue;
            evidence[kW].dates.add(sc.datetime);
            const mW=(gW-sW)/(gW+sW);
            if(waterMax[kW]===undefined||mW>waterMax[kW])waterMax[kW]=mW;
            const nV=(nW-rW)/(nW+rW);
            evidence[kW].ndvi.push(nV);evidence[kW].mndwi.push(mW);
            if(vegMax[kW]===undefined||nV>vegMax[kW])vegMax[kW]=nV;
            usedW++;
          }
          waterScenes.push({id:sc.id,cloud:sc.cloud,datetime:sc.datetime,window:w.label,usedCells:usedW});
        }catch(err){
          console.warn("DENDROGEO · Sentinel-2 su sahnesi atlandı:",sc.id,String(err&&err.message||err).slice(0,120));
        }
      }
    }
    window.DG_MERGE_SENTINEL_ANNUAL_EVIDENCE.merge({out,evidence,waterMax,vegMax,confirmedExtreme:dgS2ConfirmedExtreme,vegetationSummary:dgS2VegetationSummary});
  }

  if(window.DG_BUILD_SENTINEL_PROFILE)return window.DG_BUILD_SENTINEL_PROFILE.finish({out,acc,evidence,waterMax,vegMax,cellCount:cells.length,found,waterScenes,epsg,skipped,nProfiled:nOk},{confirmedExtreme:dgS2ConfirmedExtreme,vegetationSummary:dgS2VegetationSummary});

  // Relative green-signal view can also be used for the recent-scene mode.
  // Keep it as profile metadata only: it never changes the ESA class or area.
  for(const key of Object.keys(out)){
    const e=evidence[key];
    const summary=dgS2VegetationSummary(e);
    if(!Number.isFinite(out[key].ndviMedianYear))out[key].ndviMedianYear=summary.ndviMedianYear;
    out[key].ndviObs=summary.ndviObs;
  }

  return{
    cells:out,
    scenes:found.scenes.map(s=>({id:s.id,cloud:s.cloud,datetime:s.datetime,usedCells:s.usedCells||0})),
    waterScenes,
    range:found.range,
    radiometryVersion:"pb04-offset-v1",
    evidenceVersion:"distinct-dates-index-median-confirmed-extremes-v3-relative-ndvi",
    epsg,
    skipped,
    stats:{nCells:cells.length,nProfiled:nOk,nInsufficient:cells.length-nOk,nMissing:cells.length-Object.keys(acc).length}
  };
}
/* MIN_OBS guard'ı lc-validate sabitiyle TEK kaynaktan: zincirde lc-validate
 * bu dosyadan ÖNCE yüklenir; yoksa (eski zincir/tek başına test) 3'e düşer. */
const DG_S2_MIN_OBS_GUARD=(window.DG_LC_VALIDATE&&window.DG_LC_VALIDATE.spectral&&window.DG_LC_VALIDATE.spectral.MIN_OBS)||3;

function dgS2AssetEpsg(image){
  if(window.DG_SENTINEL_RASTER_GRID)return window.DG_SENTINEL_RASTER_GRID.assetEpsg(image);
  try{
    const keys=typeof image.getGeoKeys==="function"?image.getGeoKeys():null;
    const k=Math.round(Number(keys&&keys.ProjectedCSTypeGeoKey||0));
    if((k>=32601&&k<=32660)||(k>=32701&&k<=32760))return k;
  }catch(e){/* geokeys yoksa varsayılan */}
  throw Error("Sentinel-2 bant koordinat sistemi eksik veya desteklenmiyor; sahne kullanılmadı.");
}

/* Spektral profilden hücre bazında tahmin üret (lc-validate kural seti) */
function dgS2PredictAll(profile){
  const pred=window.DG_LC_VALIDATE?window.DG_LC_VALIDATE.spectralPredict:null;
  if(!pred)throw new Error("lc-validate yüklenmeden spektral tahmin üretilemez.");
  for(const key of Object.keys(profile.cells||{})){
    const c=profile.cells[key];
    c.predict=c.predict||pred(c);
  }
  return profile;
}

window.DG_LC_S2={
  collection:DG_S2_COLLECTION,
  maxScenes:DG_S2_MAX_SCENES,
  maxCloud:DG_S2_MAX_CLOUD,
  bands:DG_S2_BANDS,
  sclValid:DG_S2_SCL_VALID,
  findScenes:dgS2FindScenes,
  profile:dgS2Profile,
  predictAll:dgS2PredictAll,
  seasonRange:dgS2SeasonRange,
  waterWindows:dgS2WaterWindows
};
