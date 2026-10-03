"use strict";
/* DendroGeo · services/lc-s2.js — SENTINEL-2 SPEKTRAL ÇAPRAZ KANIT (Çalışma Sahası v5)
 *
 * AMAÇ: LULC sınıflandırmasından BAĞIMSIZ ikinci bir otomatik kanıt hattı.
 * Planetary Computer'daki Sentinel-2 L2A sahnelerinden (10 m, atmosferik
 * düzeltmeli, CC BY 4.0) parkın referans dönemi için bulutsuz medyan
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
 * Referans dönemi VARSAYILAN: WorldCover'ın yılı (2021) vejetasyon sezonu
 * (1 Haziran – 30 Eylül) — harita hangi dönemi temsil ediyorsa doğrulama
 * görüntüsü de o dönemin olmalı (fenolojik tutarlılık). Kullanıcı "güncel"
 * seçerse tarih aralığı değişir; karne bunu beyan eder.
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
  const y=Number(year)||2021;
  return mode==="latest"
    ?{start:(new Date().getUTCFullYear())+"-05-01T00:00:00Z",end:(new Date().getUTCFullYear())+"-10-01T00:00:00Z",label:"güncel sezon (değişim notu)"}
    :{start:y+"-06-01T00:00:00Z",end:y+"-09-30T23:59:59Z",label:y+" vejetasyon sezonu (1 Haz – 30 Eyl)"};
}

/* STAC sahne araması: GET (CORS dersi) → buluta göre sırala → en temiz N */
async function dgS2FindScenesRange(bbox,start,end,maxN){
  const qs=new URLSearchParams({
    collections:DG_S2_COLLECTION,
    bbox:[bbox.minLon,bbox.minLat,bbox.maxLon,bbox.maxLat].join(","),
    datetime:start+"/"+end,
    limit:String(DG_S2_SEARCH_LIMIT)
  });
  const data=await dgLcFetchJson(DG_LC_STAC+"/search?"+qs.toString(),{
    headers:{Accept:"application/geo+json"}
  });
  const items=Array.isArray(data&&data.features)?data.features:[];
  const ranked=items
    .map(it=>({it,cloud:Number((it.properties&&it.properties["eo:cloud_cover"])??101)}))
    .filter(x=>x.cloud<=DG_S2_MAX_CLOUD)
    .sort((a,b)=>a.cloud-b.cloud)
    .slice(0,maxN||DG_S2_MAX_SCENES);
  return ranked.map(x=>({
    id:x.it.id,
    item:x.it,
    cloud:+x.cloud.toFixed(1),
    datetime:String((x.it.properties&&(x.it.properties.datetime||x.it.properties.sentinel_product_id))||x.it.id).slice(0,10)
  }));
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
function dgS2WaterWindows(year){
  const y=Number(year)||2021;
  return[
    {start:y+"-02-01T00:00:00Z",end:y+"-05-31T23:59:59Z",max:3,label:y+" ilkbahar (yüksek su)"},
    {start:y+"-10-01T00:00:00Z",end:y+"-12-15T23:59:59Z",max:2,label:y+" sonbahar"}
  ];
}

/* Bir sahnenin tek bandı için pencere okuması.
 *
 * ⚠ EPSG DİSİPLİNİ (lc-engine'deki 4326/UTM dersinin Sentinel-2 şubesi):
 * S2 COG'ları KENDİ UTM bölgesindedir (proj:epsg). Park bölge sınırına
 * yakınsa analiz EPSG'si ile sahne EPSG'si FARKLI olabilir; pencere bu
 * yüzden her görüntüde KENDİ epsg'sine projekte edilen bbox'tan hesaplanır.
 * Aynı disiplin hücre merkezi indekslemede de uygulanır (dgS2CellIndexXY). */
async function dgS2ReadBand(image,bboxDeg){
  const epsg=dgS2AssetEpsg(image);
  const meta=dgLcImageMeta(image);
  const win=dgLcWindowForPark(meta,dgS2UtmBBox(bboxDeg,epsg));
  const values=await image.readRasters({window:win,samples:[0],interleave:true});
  return{meta,win,values,epsg};
}

function dgS2UtmBBox(bboxDeg,epsg){
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
  const col=Math.floor((x-meta.minX)/meta.dx);
  const row=Math.floor((meta.maxY-y)/meta.dy);
  const lc=col-win[0],lr=row-win[1];
  const w=win[2]-win[0],h=win[3]-win[1];
  if(lc<0||lr<0||lc>=w||lr>=h)return null;
  return lr*w+lc;
}

function dgS2Median(arr){
  if(!arr.length)return null;
  const s=arr.slice().sort((a,b)=>a-b);
  const m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
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
  const token=await dgLcGetSas(DG_S2_COLLECTION);
  const bboxDeg=bbox;

  const acc={};   /* key → {b03:[],b04:[],b08:[],b11:[]} */
  const skipped=[];
  for(const sc of found.scenes){
    try{
      const assets=sc.item.assets||{};
      const hrefFor=name=>{
        const a=assets[name];
        return a&&a.href?dgLcSignedHref(a.href,token):null;
      };
      const bandReads={};
      for(const b of Object.keys(DG_S2_BANDS)){
        const href=hrefFor(b);
        if(!href)throw new Error(b+" asset'i yok");
        bandReads[b]=GeoTIFF.fromUrl(href).then(t=>t.getImage());
      }
      const images={};
      for(const b of Object.keys(bandReads))images[b]=await bandReads[b];

      /* SCL önce: geçerlilik maskesi 20 m ızgarada */
      const scl=await dgS2ReadBand(images.SCL,bboxDeg);
      const reads={};
      for(const b of ["B03","B04","B08","B11"]){
        reads[b]=await dgS2ReadBand(images[b],bboxDeg);
      }
      /* Hücre merkezleri her bandın KENDİ epsg'sinde indekslenir */
      const cellIdx=band=>cells.map(c=>{
        const z=dgLcUtmForward(c.center.lat,c.center.lon,band.epsg);
        return dgS2CellIndex(band.meta,band.win,z.x,z.y);
      });
      const idxScl=cellIdx(scl);
      const idxB={B03:cellIdx(reads.B03),B04:cellIdx(reads.B04),B08:cellIdx(reads.B08),B11:cellIdx(reads.B11)};

      let used=0;
      for(let ci=0;ci<cells.length;ci++){
        const si=idxScl[ci];
        if(si===null)continue;
        const sclVal=Number(scl.values[si]);
        if(!DG_S2_SCL_VALID.includes(Math.round(sclVal)))continue;
        const vals={};
        let ok=true;
        for(const b of ["B03","B04","B08","B11"]){
          const bi=idxB[b][ci];
          if(bi===null){ok=false;break;}
          const v=Number(reads[b].values[bi]);
          if(!Number.isFinite(v)||v<=0||v>DG_S2_SCALE){ok=false;break;} /* nodata/doygun */
          vals[b]=v/DG_S2_SCALE;
        }
        if(!ok)continue;
        const key=cells[ci].row+":"+cells[ci].col;
        if(!acc[key])acc[key]={b03:[],b04:[],b08:[],b11:[],mndwis:[],ndvis:[]};
        acc[key].b03.push(vals.B03);
        acc[key].b04.push(vals.B04);
        acc[key].b08.push(vals.B08);
        acc[key].b11.push(vals.B11);
        /* SAHNE-BAŞI MNDWI: mevsimsel su kanıtı için. Dünya örtüsü sınıf 80
         * "yılın çoğunda su" demektir; GÖKSU CANLI DERSİ (2026-10-03): gölün
         * sığ kıyıları yaz sonu çekiliyor, yaz medyanı suyun %25'inde
         * MNDWI≤0.01 veriyor → medyan tek başına mevsimsel suyu kaçırır.
         * MAX MNDWI "bu hücre sezonun herhangi bir anında açık su muydu"
         * sorusunu cevaplar (kalıcı su için medyan zaten yeter). */
        const gSW=vals.B03,swSW=vals.B11;
        if(gSW+swSW>0)acc[key].mndwis.push((gSW-swSW)/(gSW+swSW));
        const rSW=vals.B04,nSW=vals.B08;
        if(rSW+nSW>0)acc[key].ndvis.push((nSW-rSW)/(nSW+rSW));
        used++;
      }
      sc.usedCells=used;
    }catch(err){
      skipped.push({id:sc.id,reason:String(err&&err.message||err).slice(0,160)});
      console.warn("DENDROGEO · Sentinel-2 sahnesi atlandı:",sc.id,String(err&&err.message||err).slice(0,120));
    }
  }

  /* Medyan kompozit + indeksler */
  const out={};
  let nOk=0,nLow=0;
  for(const key of Object.keys(acc)){
    const a=acc[key];
    const obs=Math.min(a.b03.length,a.b04.length,a.b08.length,a.b11.length);
    const g=dgS2Median(a.b03),r=dgS2Median(a.b04),nir=dgS2Median(a.b08),sw=dgS2Median(a.b11);
    if(obs<DG_S2_MIN_OBS_GUARD||g===null||r===null||nir===null||sw===null){out[key]={obs,predict:"nodata"};nLow++;continue;}
    const ndvi=(nir-r)/(nir+r);
    const mndwi=(g-sw)/(g+sw);
    const ndbi=(sw-nir)/(sw+nir);
    const mndwiMax=a.mndwis&&a.mndwis.length?Math.max(...a.mndwis):mndwi;
    const ndviMax=a.ndvis&&a.ndvis.length?Math.max(...a.ndvis):ndvi;
    out[key]={
      obs,
      b03:+g.toFixed(4),b04:+r.toFixed(4),b08:+nir.toFixed(4),b11:+sw.toFixed(4),
      ndvi:+ndvi.toFixed(4),mndwi:+mndwi.toFixed(4),ndbi:+ndbi.toFixed(4),
      mndwiMax:+mndwiMax.toFixed(4),ndviMax:+ndviMax.toFixed(4)
    };
    nOk++;
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
  const waterMax={};
  const vegMax={};
  const waterScenes=[];
  if(o.waterYear!==false){
    for(const w of dgS2WaterWindows(o.year||2021)){
      let wScenes=[];
      try{wScenes=await dgS2FindScenesRange(bbox,w.start,w.end,w.max);}catch(err){wScenes=[];}
      for(const sc of wScenes){
        try{
          const assets=sc.item.assets||{};
          const hrefFor=n2=>{const a2=assets[n2];return a2&&a2.href?dgLcSignedHref(a2.href,token):null;};
          const hB03=hrefFor("B03"),hB04=hrefFor("B04"),hB08=hrefFor("B08"),hB11=hrefFor("B11"),hSCL=hrefFor("SCL");
          if(!hB03||!hB04||!hB08||!hB11||!hSCL)continue;
          const imgs=await Promise.all([
            GeoTIFF.fromUrl(hB03).then(t=>t.getImage()),
            GeoTIFF.fromUrl(hB04).then(t=>t.getImage()),
            GeoTIFF.fromUrl(hB08).then(t=>t.getImage()),
            GeoTIFF.fromUrl(hB11).then(t=>t.getImage()),
            GeoTIFF.fromUrl(hSCL).then(t=>t.getImage())
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
            const gW=Number(rB03.values[i3[ci]]),rW=Number(rB04.values[i4[ci]]);
            const nW=Number(rB08.values[i8[ci]]),sW=Number(rB11.values[i1[ci]]);
            const okB=v=>Number.isFinite(v)&&v>0&&v<=DG_S2_SCALE;
            if(!okB(gW)||!okB(rW)||!okB(nW)||!okB(sW))continue;
            const kW=cells[ci].row+":"+cells[ci].col;
            const mW=(gW-sW)/(gW+sW);
            if(waterMax[kW]===undefined||mW>waterMax[kW])waterMax[kW]=mW;
            const nV=(nW-rW)/(nW+rW);
            if(vegMax[kW]===undefined||nV>vegMax[kW])vegMax[kW]=nV;
            usedW++;
          }
          waterScenes.push({id:sc.id,cloud:sc.cloud,datetime:sc.datetime,window:w.label,usedCells:usedW});
        }catch(err){
          console.warn("DENDROGEO · Sentinel-2 su sahnesi atlandı:",sc.id,String(err&&err.message||err).slice(0,120));
        }
      }
    }
    for(const key of Object.keys(out)){
      const c0=out[key];
      const wm=waterMax[key];
      const summer=Number.isFinite(c0.mndwiMax)?c0.mndwiMax:null;
      const merged=(wm!==undefined&&summer!==null)?Math.max(wm,summer):(wm!==undefined?wm:summer);
      if(merged!==null&&Number.isFinite(merged))c0.mndwiMaxYear=+merged.toFixed(4);
      const vm2=vegMax[key];
      const summerV=Number.isFinite(c0.ndviMax)?c0.ndviMax:null;
      const mergedV=(vm2!==undefined&&summerV!==null)?Math.max(vm2,summerV):(vm2!==undefined?vm2:summerV);
      if(mergedV!==null&&Number.isFinite(mergedV))c0.ndviMaxYear=+mergedV.toFixed(4);
    }
  }

  return{
    cells:out,
    scenes:found.scenes.map(s=>({id:s.id,cloud:s.cloud,datetime:s.datetime,usedCells:s.usedCells||0})),
    waterScenes,
    range:found.range,
    epsg,
    skipped,
    stats:{nCells:cells.length,nProfiled:nOk,nInsufficient:nLow}
  };
}
/* MIN_OBS guard'ı lc-validate sabitiyle TEK kaynaktan: zincirde lc-validate
 * bu dosyadan ÖNCE yüklenir; yoksa (eski zincir/tek başına test) 3'e düşer. */
const DG_S2_MIN_OBS_GUARD=(window.DG_LC_VALIDATE&&window.DG_LC_VALIDATE.spectral&&window.DG_LC_VALIDATE.spectral.MIN_OBS)||3;

function dgS2AssetEpsg(image){
  try{
    const keys=typeof image.getGeoKeys==="function"?image.getGeoKeys():null;
    const k=Math.round(Number(keys&&keys.ProjectedCSTypeGeoKey||0));
    if(k>=32601&&k<=32760)return k;
  }catch(e){/* geokeys yoksa varsayılan */}
  return dgLcUtmEpsgForLatLon(40,32);
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
  seasonRange:dgS2SeasonRange
};
