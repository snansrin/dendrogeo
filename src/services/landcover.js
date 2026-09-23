"use strict";
/* DendroGeo · 10 m Land Cover Engine v3
 * Native UTM COG + STAC + polygon/cell coverage analysis.
 *
 * The application does NOT query a live imagery service for classification.
 * It reads the published annual categorical land-cover COG that matches the
 * native 10 m UTM tiling grid, then computes each raster-cell intersection
 * with the selected park polygon.
 */

/* ---------------------------------------------------------------------------
 * ÇİFT KAYNAKLI ARAZİ ÖRTÜSÜ MOTORU (v4)
 *
 * BİRİNCİL: ESA WorldCover 2021 (v200) — 10 m, Sentinel-1 + Sentinel-2 füzyonu,
 *   11 tematik sınıf. Park ölçeğinde en güvenilir tematik ürün: ağaç / çayır /
 *   yapılı / su ayrımını io-lulc'dan belirgin biçimde daha iyi yapar.
 *   COG'lar EPSG:4326'dır → hücreler metrede anizotropiktir (~7,1 x 9,3 m,
 *   enleme bağlı). Bu yüzden hücreler analiz UTM'sine köşelerinden
 *   projekte edilir ve alanlar TAM dışbükey kesişimle hesaplanır.
 *
 * ÇAPRAZ: IO LULC yıllık 2020 — 10 m, UTM karoları. Bağımsız ikinci görüş;
 *   grup başına UZLAŞMA yüzdesi raporlanır (belirsizlik göstergesi).
 *   Bu kaynakta 2020 dışındaki yılların karışması QA hatasına yol açtığı
 *   için (bkz. dgLcFindTiles yıl filtresi) sonuçlar yıl süzgecinden geçer.
 * ------------------------------------------------------------------------- */
const DG_LC_STAC="https://planetarycomputer.microsoft.com/api/stac/v1";

const DG_LC_SOURCES={
  primary:{
    key:"primary",
    collection:"esa-worldcover",
    year:2021,
    assetKeys:["map","data"],
    label:"ESA WorldCover 10 m · 2021 (v200)",
    citation:"ESA WorldCover 10 m 2021 v200, CC BY 4.0",
  },
  cross:{
    key:"cross",
    collection:"io-lulc-annual-v02",
    year:2020,
    assetKeys:["data","lulc"],
    label:"IO LULC 10 m · 2020 (çapraz doğrulama)",
    citation:"Impact Observatory 10m Annual LULC v02, CC BY 4.0",
  },
};
/* Geriye dönük uyumluluk için eski sabitler */
const DG_LC_COLLECTION=DG_LC_SOURCES.cross.collection;
const DG_LC_YEAR=DG_LC_SOURCES.cross.year;
const DG_LC_SAS="https://planetarycomputer.microsoft.com/api/sas/v1/token/";

/* ESA WorldCover sınıf kodları → DendroGeo rapor grupları */
const DG_ESA_CODES={
  10:"Ağaç",20:"Çalı",30:"Çayır",40:"Tarım",50:"Yapılı",60:"Çıplak",
  70:"Kar/buz",80:"Su",90:"Otsu sulak",95:"Mangrov",100:"Yosun",
};
const DG_ESA_GROUP={
  10:"green",20:"green",30:"green",40:"green",95:"green",100:"green",
  50:"hard",60:"bare",70:"other",80:"water",90:"water",
};
const DG_LC_PIXEL_M=10;
const DG_LC_MAX_TILES=12;
const DG_LC_MAX_READ_PIXELS=2500000;
const DG_LC_RENDER_LIMIT=6000;

const DG_LC_CODES={
  1:"Su",
  2:"Ağaç",
  4:"Taşkın vejetasyon",
  5:"Tarım",
  7:"Yapılı alan",
  8:"Çıplak zemin",
  9:"Kar/buz",
  10:"Bulut",
  11:"Mera/rangeland"
};

/* Harita + rapor renk paleti (kullanıcı tercihi, 2026-09-20):
 *   yeşil = AÇIK yeşil · su = mavi · sert zemin = gri · çıplak = kahverengi
 * Harita katmanları ŞEFFAF çizilir (fillOpacity .38 / opacity .50). */
const DG_LC_CLASSES=[
  {key:"green",label:"Yeşil alan",emoji:"🌿",codes:[2,4,5,11],color:"#4ade80"},
  {key:"water",label:"Su",emoji:"💧",codes:[1],color:"#3b82f6"},
  {key:"hard",label:"Sert zemin",emoji:"🧱",codes:[7],color:"#64748b"},
  {key:"bare",label:"Çıplak zemin",emoji:"🟫",codes:[8],color:"#8b5a2b"},
  {key:"other",label:"Diğer",emoji:"⬜",codes:[],color:"#94a3b8"}
];

let DG_LC_LAYER=null;
let DG_LC_LAST=null;

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

function dgLcBboxFromGeometry(outer,holes){
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  const visit=ring=>{
    for(const p of (ring||[])){
      const lat=Number(p?.[0]),lon=Number(p?.[1]);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
      minLat=Math.min(minLat,lat);
      maxLat=Math.max(maxLat,lat);
      minLon=Math.min(minLon,lon);
      maxLon=Math.max(maxLon,lon);
    }
  };
  (outer||[]).forEach(visit);
  (holes||[]).forEach(visit);
  if(!(minLat<=maxLat&&minLon<=maxLon)){
    throw new Error("Park polygonu için geçerli koordinat kutusu üretilemedi.");
  }
  return{minLat,maxLat,minLon,maxLon};
}

function dgLcUtmEpsgForLatLon(lat,lon){
  const zone=Math.max(1,Math.min(60,Math.floor((Number(lon)+180)/6)+1));
  return Number(lat)>=0?32600+zone:32700+zone;
}


function dgLcUtmForward(lat,lon,epsg){
  const a=6378137;
  const e2=0.0066943799901413165;
  const ep2=e2/(1-e2);
  const k0=0.9996;
  const la=Number(lat)*Math.PI/180;
  const lo=Number(lon)*Math.PI/180;
  const zone=Number(epsg)%100;
  const south=Number(epsg)>=32700;
  const lon0=((zone-1)*6-180+3)*Math.PI/180;
  const sin=Math.sin(la),cos=Math.cos(la),tan=Math.tan(la);
  const N=a/Math.sqrt(1-e2*sin*sin);
  const T=tan*tan;
  const C=ep2*cos*cos;
  const A=cos*(lo-lon0);
  const M=a*((1-e2/4-3*e2*e2/64-5*e2*e2*e2/256)*la
    -(3*e2/8+3*e2*e2/32+45*e2*e2*e2/1024)*Math.sin(2*la)
    +(15*e2*e2/256+45*e2*e2*e2/1024)*Math.sin(4*la)
    -(35*e2*e2*e2/3072)*Math.sin(6*la));
  const x=k0*N*(A+(1-T+C)*Math.pow(A,3)/6
    +(5-18*T+T*T+72*C-58*ep2)*Math.pow(A,5)/120)+500000;
  let y=k0*(M+N*tan*(A*A/2
    +(5-T+9*C+4*C*C)*Math.pow(A,4)/24
    +(61-58*T+T*T+600*C-330*ep2)*Math.pow(A,6)/720));
  if(south)y+=10000000;
  return{x,y};
}

function dgLcUtmInverse(x,y,epsg){
  const a=6378137;
  const e2=0.0066943799901413165;
  const ep2=e2/(1-e2);
  const k0=0.9996;
  const zone=Number(epsg)%100;
  const south=Number(epsg)>=32700;
  const lon0=((zone-1)*6-180+3)*Math.PI/180;
  let yy=Number(y);
  if(south)yy-=10000000;
  const M=yy/k0;
  const mu=M/(a*(1-e2/4-3*e2*e2/64-5*e2*e2*e2/256));
  const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const J1=3*e1/2-27*Math.pow(e1,3)/32;
  const J2=21*e1*e1/16-55*Math.pow(e1,4)/32;
  const J3=151*Math.pow(e1,3)/96;
  const J4=1097*Math.pow(e1,4)/512;
  const fp=mu+J1*Math.sin(2*mu)+J2*Math.sin(4*mu)+J3*Math.sin(6*mu)+J4*Math.sin(8*mu);
  const sin=Math.sin(fp),cos=Math.cos(fp),tan=Math.tan(fp);
  const C1=ep2*cos*cos;
  const T1=tan*tan;
  const N1=a/Math.sqrt(1-e2*sin*sin);
  const R1=a*(1-e2)/Math.pow(1-e2*sin*sin,1.5);
  const D=(Number(x)-500000)/(N1*k0);
  const lat=fp-(N1*tan/R1)*(D*D/2
    -(5+3*T1+10*C1-4*C1*C1-9*ep2)*Math.pow(D,4)/24
    +(61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*Math.pow(D,6)/720);
  const lon=lon0+(D-(1+2*T1+C1)*Math.pow(D,3)/6
    +(5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*Math.pow(D,5)/120)/cos;
  return{lat:lat*180/Math.PI,lon:lon*180/Math.PI};
}

function dgLcSignedHref(href,token){
  if(!token)return href;
  const t=String(token).replace(/^[?&]/,"");
  if(!t)return href;
  return href+(href.includes("?")?"&":"?")+t;
}

function dgLcRingBBoxXY(ring){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of (ring||[])){
    minX=Math.min(minX,p.x);
    minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x);
    maxY=Math.max(maxY,p.y);
  }
  return{minX,minY,maxX,maxY};
}

function dgLcBboxOverlap(a,b){
  /* Savunmacı: a, dgLcProjectGeometry'nin atadığı _bbox'tur. Bugünkü çağrı
   * yolunda daima doludur, ama halka başka bir yoldan gelirse a.maxX
   * TypeError fırlatıyordu. Üstüşme yok saymak, analiz çökmesinden iyidir. */
  if(!a||!b)return false;
  return !(a.maxX<=b.minX||a.minX>=b.maxX||a.maxY<=b.minY||a.minY>=b.maxY);
}

function dgLcClipPolygonRect(poly,rect){
  if(!Array.isArray(poly)||poly.length<3)return[];
  let out=poly.slice();

  const clip=(inside,intersect)=>{
    if(!out.length)return;
    const input=out;
    out=[];
    let s=input[input.length-1];
    for(const e of input){
      const ein=inside(e),sin=inside(s);
      if(ein){
        if(!sin)out.push(intersect(s,e));
        out.push(e);
      }else if(sin){
        out.push(intersect(s,e));
      }
      s=e;
    }
  };

  clip(p=>p.x>=rect.minX,(a,b)=>{
    const dx=b.x-a.x||1e-12;
    const t=(rect.minX-a.x)/dx;
    return{x:rect.minX,y:a.y+(b.y-a.y)*t};
  });
  clip(p=>p.x<=rect.maxX,(a,b)=>{
    const dx=b.x-a.x||1e-12;
    const t=(rect.maxX-a.x)/dx;
    return{x:rect.maxX,y:a.y+(b.y-a.y)*t};
  });
  clip(p=>p.y>=rect.minY,(a,b)=>{
    const dy=b.y-a.y||1e-12;
    const t=(rect.minY-a.y)/dy;
    return{x:a.x+(b.x-a.x)*t,y:rect.minY};
  });
  clip(p=>p.y<=rect.maxY,(a,b)=>{
    const dy=b.y-a.y||1e-12;
    const t=(rect.maxY-a.y)/dy;
    return{x:a.x+(b.x-a.x)*t,y:rect.maxY};
  });

  return out;
}

/* Dışbükey kırpma penceresi ile Sutherland-Hodgman.
 * dgLcClipPolygonRect'in genellemesidir: kırpma bölgesi eksen hizalı
 * dikdörtgen olmak zorunda değildir. EPSG:4326 rasterlarda hücrenin dört
 * köşesi analiz UTM'sine projekte edildiğinde hafif yamuk bir dörtgen
 * oluşur; dikdörtgen özel durumu da aynı koddan geçer (testlerle kilitli).
 *
 * clipPoly köşeleri SAAT YÖNÜNÜN TERSİ (CCW) verilmelidir; değilse içeride
 * çevrilir. */
function dgLcEnsureCcw(poly){
  let a=0;
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length];
    a+=p.x*q.y-q.x*p.y;
  }
  return a<0?poly.slice().reverse():poly;
}
function dgLcClipPolygonConvex(poly,clipRaw){
  if(!Array.isArray(poly)||poly.length<3)return[];
  const clip=dgLcEnsureCcw(clipRaw);
  if(clip.length<3)return[];
  let out=poly.slice();
  for(let i=0;i<clip.length&&out.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length];
    // yarı-düzlem: (b-a) x (p-a) >= 0  (CCW kenarın solu)
    const inside=p=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-1e-9;
    const intersect=(p,q)=>{
      const x1=p.x,y1=p.y,x2=q.x,y2=q.y,x3=a.x,y3=a.y,x4=b.x,y4=b.y;
      const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
      if(!den)return {x:q.x,y:q.y};
      const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den;
      return {x:x1+t*(x2-x1),y:y1+t*(y2-y1)};
    };
    const input=out;out=[];
    let prev=input[input.length-1],prevIn=inside(prev);
    for(const cur of input){
      const curIn=inside(cur);
      if(curIn){
        if(!prevIn)out.push(intersect(prev,cur));
        out.push(cur);
      }else if(prevIn){
        out.push(intersect(prev,cur));
      }
      prev=cur;prevIn=curIn;
    }
  }
  return out;
}
/* Park poligonu (delikli) ∩ dışbükey hücre dörtgeni = m² */
/* Dikdörtgen (eksen hizalı) hücre kesişimi — ESA geçişinden önceki sürüm.
 * Üretimde dgLcIntersectionAreaConvex kullanılır; bu fonksiyon testlerde
 * REFERANS gerçekleme olarak korunur (convex ile aynı sonucu üretmeli). */
function dgLcIntersectionArea(outerRings,holeRings,rect){
  let area=0;
  for(const ring of (outerRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,rect))continue;
    area+=dgLcPlanarArea(dgLcClipPolygonRect(ring,rect));
  }
  for(const ring of (holeRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,rect))continue;
    area-=dgLcPlanarArea(dgLcClipPolygonRect(ring,rect));
  }
  return Math.max(0,area);
}

function dgLcIntersectionAreaConvex(outerRings,holeRings,quad){
  let area=0;
  for(const ring of (outerRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,quad._bbox))continue;
    area+=dgLcPlanarArea(dgLcClipPolygonConvex(ring,quad));
  }
  for(const ring of (holeRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,quad._bbox))continue;
    area-=dgLcPlanarArea(dgLcClipPolygonConvex(ring,quad));
  }
  return Math.max(0,area);
}
/* Dört köşeden _bbox türet */
function dgLcQuadBBox(quad){
  return quad.reduce((a,p)=>({
    minX:Math.min(a.minX,p.x),minY:Math.min(a.minY,p.y),
    maxX:Math.max(a.maxX,p.x),maxY:Math.max(a.maxY,p.y),
  }),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
}

function dgLcPlanarArea(poly){
  if(!Array.isArray(poly)||poly.length<3)return 0;
  let s=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    s+=a.x*b.y-b.x*a.y;
  }
  return Math.abs(s)/2;
}


function dgLcProjectGeometry(outer,holes,epsg){
  const projectRing=ring=>{
    const p=(ring||[]).map(q=>{
      const z=dgLcUtmForward(Number(q[0]),Number(q[1]),epsg);
      return{x:z.x,y:z.y};
    });
    p._bbox=dgLcRingBBoxXY(p);
    return p;
  };
  return{
    outer:(outer||[]).map(projectRing).filter(r=>r.length>=3),
    holes:(holes||[]).map(projectRing).filter(r=>r.length>=3)
  };
}

function dgLcProjectedArea(geometry){
  let a=0;
  for(const r of geometry.outer)a+=dgLcPlanarArea(r);
  for(const r of geometry.holes)a-=dgLcPlanarArea(r);
  return Math.max(0,a);
}

function dgLcCodeToClass(code){
  const n=Math.round(Number(code));
  if(n===3||n===6)return 11;
  if(n===0)return 0;
  return Object.prototype.hasOwnProperty.call(DG_LC_CODES,n)?n:null;
}

function dgLcReportClassForCode(code){
  for(const cls of DG_LC_CLASSES){
    if(cls.codes.includes(code))return cls.key;
  }
  return null;
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
  const payload={
    collections:[src.collection],
    bbox:[bbox.minLon,bbox.minLat,bbox.maxLon,bbox.maxLat],
    datetime:src.year+"-01-01T00:00:00Z/"+src.year+"-12-31T23:59:59Z",
    limit:DG_LC_MAX_TILES
  };
  const data=await dgLcFetchJson(DG_LC_STAC+"/search",{
    method:"POST",
    headers:{
      Accept:"application/geo+json",
      "Content-Type":"application/json"
    },
    body:JSON.stringify(payload)
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

function dgLcRunPush(runs,row,start,end,cls,meta,epsg){
  if(end<=start)return;
  const yTop=meta.maxY-row*meta.dy;
  const yBottom=yTop-meta.dy;
  runs.push({
    row,
    col0:start,
    col1:end,
    classKey:cls,
    epsg,
    x0:meta.minX+start*meta.dx,
    x1:meta.minX+end*meta.dx,
    y0:yBottom,
    y1:yTop
  });
}

/* Grup eşlemesi kaynağa göre: ESA WorldCover kodları ile io-lulc kodları farklı. */
function dgLcGroupForCode(code,source){
  const n=Math.round(Number(code));
  if(!Number.isFinite(n))return null;
  if(source&&source.key==="primary")return DG_ESA_GROUP[n]||null;
  return dgLcReportClassForCode(dgLcCodeToClass(n));
}
/* Maskeli (hesaba katılmayan) kodlar: ESA'da yalnız NoData; io-lulc'da
 * NoData + kar + bulut. */
function dgLcIsMasked(code,source){
  const n=Math.round(Number(code));
  if(!Number.isFinite(n))return true;
  if(source&&source.key==="primary")return n===0;
  return n===0||n===9||n===10;
}

/* Bir veri karosunu işler.
 *
 * CRS desteği:
 *   · UTM karoları (io-lulc): hücreler analiz UTM'sinde eksen hizalı dikdörtgen.
 *   · EPSG:4326 karoları (ESA WorldCover): hücrenin derece köşeleri analiz
 *     UTM'sine projekte edilir → hafif yamuk dışbükey dörtgen; alanlar
 *     dgLcIntersectionAreaConvex ile TAM hesaplanır. Metrede anizotropik
 *     (~7,1 x 9,3 m) hücrenin gerçek şekli korunur.
 *
 * Çıktılar grup anahtarlıdır (green/water/hard/bare/other) + ham kod kırılımı.
 */
function dgLcProcessTile(item,href,geometryWgs,source){
  const src=source||DG_LC_SOURCES.cross;
  return GeoTIFF.fromUrl(href).then(async tiff=>{
    const image=await tiff.getImage();
    const keys=typeof image.getGeoKeys==="function"?image.getGeoKeys():null;
    const keyEpsg=Math.round(Number(keys&&keys.ProjectedCSTypeGeoKey||0));
    const propEpsg=Math.round(Number(item?.properties?.["proj:epsg"]||0));
    const rasterEpsg=keyEpsg||propEpsg||4326;
    const isUtm=rasterEpsg>=32601&&rasterEpsg<=32760;
    const analysisEpsg=isUtm?rasterEpsg:dgLcUtmEpsgForLatLon(
      (geometryWgs.outer[0]?.[0]?.[0]??40),
      (geometryWgs.outer[0]?.[0]?.[1]??32)
    );
    const geometry=dgLcProjectGeometry(geometryWgs.outer,geometryWgs.holes,analysisEpsg);
    const parkAreaNative=dgLcProjectedArea(geometry);
    if(!(parkAreaNative>0))throw new Error("Park polygonu veri karosunun UTM alanında geçersiz.");

    const meta=dgLcImageMeta(image);
    const parkBBox=geometry.outer.reduce((acc,r)=>{
      acc.minX=Math.min(acc.minX,r._bbox.minX);
      acc.minY=Math.min(acc.minY,r._bbox.minY);
      acc.maxX=Math.max(acc.maxX,r._bbox.maxX);
      acc.maxY=Math.max(acc.maxY,r._bbox.maxY);
      return acc;
    },{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});

    /* Okuma penceresi: UTM'de metre, 4326'da derece uzayında hesaplanır. */
    let win;
    if(isUtm){
      win=dgLcWindowForPark(meta,parkBBox);
    }else{
      const wgs=dgLcBboxFromGeometry(geometryWgs.outer,geometryWgs.holes);
      const minCol=Math.max(0,Math.floor((wgs.minLon-meta.minX)/meta.dx)-1);
      const maxCol=Math.min(meta.width,Math.ceil((wgs.maxLon-meta.minX)/meta.dx)+1);
      const minRow=Math.max(0,Math.floor((meta.maxY-wgs.maxLat)/meta.dy)-1);
      const maxRow=Math.min(meta.height,Math.ceil((meta.maxY-wgs.minLat)/meta.dy)+1);
      if(maxCol<=minCol||maxRow<=minRow)throw new Error("Park ile 10 m veri karosu arasında piksel kesişimi yok.");
      win=[minCol,minRow,maxCol,maxRow];
    }
    const px=(win[2]-win[0])*(win[3]-win[1]);
    if(px>DG_LC_MAX_READ_PIXELS){
      throw new Error("Park alanı tek karoda çok büyük; güvenli 10 m COG okuma sınırını aşıyor.");
    }

    /* Run bantları meta uzayında (UTM karoda metre, 4326 karoda DERECE)
     * tutulur. Render'da doğru ters dönüşüm seçilsin diye run'lara meta
     * uzayının EPSG'si yazılır: 4326 karoda 4326 (derece), UTM karoda bölge.
     * ⚠️ Buraya analysisEpsg yazmak SAHADAKİ GÖRÜNMEZ KATMAN HATASIYDI:
     * derece değerler metre gibi ters UTM'ye sokulup okyanusa çiziliyordu. */
    const runEpsg=isUtm?analysisEpsg:4326;

    const values=await image.readRasters({
      window:win,
      samples:[0],
      interleave:true
    });

    const groupCounts={},groupAreas={},rawCounts={},rawAreas={};
    const runs=[];
    const cells=[];
    let assignedAreaM2=0,classifiedAreaM2=0,maskedAreaM2=0,maskedCount=0,sourceCells=0;
    const rowStart=win[1],colStart=win[0],localW=win[2]-win[0];

    for(let rr=0;rr<(win[3]-win[1]);rr++){
      const globalRow=rowStart+rr;
      let runStart=-1,runCls=null;
      for(let cc=0;cc<localW;cc++){
        const globalCol=colStart+cc;
        /* Hücre dörtgeni (analiz UTM'sinde, CCW) */
        let quad;
        if(isUtm){
          const yTop=meta.maxY-globalRow*meta.dy;
          const yBottom=yTop-meta.dy;
          const x0=meta.minX+globalCol*meta.dx;
          const x1=x0+meta.dx;
          quad=[{x:x0,y:yBottom},{x:x1,y:yBottom},{x:x1,y:yTop},{x:x0,y:yTop}];
        }else{
          const latTop=meta.maxY-globalRow*meta.dy;
          const latBot=latTop-meta.dy;
          const lon0=meta.minX+globalCol*meta.dx;
          const lon1=lon0+meta.dx;
          const f=(lon,lat)=>dgLcUtmForward(lat,lon,analysisEpsg);
          quad=[f(lon0,latBot),f(lon1,latBot),f(lon1,latTop),f(lon0,latTop)];
        }
        quad._bbox=dgLcQuadBBox(quad);
        if(!dgLcBboxOverlap(quad._bbox,parkBBox))continue;
        const area=dgLcIntersectionAreaConvex(geometry.outer,geometry.holes,quad);
        if(!(area>1e-8))continue;

        sourceCells++;
        assignedAreaM2+=area;

        const raw=Number(values[rr*localW+cc]);
        const masked=dgLcIsMasked(raw,src);
        const classKey=masked?null:dgLcGroupForCode(raw,src);

        rawCounts[raw]=(rawCounts[raw]||0)+1;
        rawAreas[raw]=(rawAreas[raw]||0)+area;

        if(masked||!classKey){
          maskedAreaM2+=area;
          maskedCount++;
          if(runStart>=0){
            dgLcRunPush(runs,globalRow,runStart,globalCol,runCls,meta,runEpsg);
            runStart=-1;runCls=null;
          }
          continue;
        }
        classifiedAreaM2+=area;
        groupCounts[classKey]=(groupCounts[classKey]||0)+1;
        groupAreas[classKey]=(groupAreas[classKey]||0)+area;

        if(runStart>=0&&runCls===classKey){
          /* bant devam ediyor */
        }else{
          if(runStart>=0)dgLcRunPush(runs,globalRow,runStart,globalCol,runCls,meta,runEpsg);
          runStart=globalCol;runCls=classKey;
        }

        if(cells.length<10000){
          const cx=(quad[0].x+quad[1].x+quad[2].x+quad[3].x)/4;
          const cy=(quad[0].y+quad[1].y+quad[2].y+quad[3].y)/4;
          const inv=p=>dgLcUtmInverse(p.x,p.y,analysisEpsg);
          /* ⚠️ SAPMA HATASI BURADAYDI: 4326 karolarında inv() argümanı yok
           * sayıp dört köşeye de HÜCRE MERKEZİNİ yazıyordu. quadWgs dört aynı
           * noktadan oluşuyor, halkalar hücre merkezlerinden kuruluyor, şekil
           * yarımşar piksel kayıyor ve alan geri ölçekleme onu şişirip komşu
           * sınıfların (su/ada) üzerine taşıyordu. Artık köşeler derece
           * sınırlarından DOĞRUDAN hesaplanır. */
          let c0,c1,c2,c3,center;
          if(isUtm){
            c0=inv(quad[0]);c1=inv(quad[1]);c2=inv(quad[2]);c3=inv(quad[3]);
            center=inv({x:cx,y:cy});
          }else{
            const latTop=meta.maxY-globalRow*meta.dy,latBot=latTop-meta.dy;
            const lon0=meta.minX+globalCol*meta.dx,lon1=lon0+meta.dx;
            c0={lat:latBot,lon:lon0};
            c1={lat:latBot,lon:lon1};
            c2={lat:latTop,lon:lon1};
            c3={lat:latTop,lon:lon0};
            center={lat:(latTop+latBot)/2,lon:(lon0+lon1)/2};
          }
          cells.push({
            row:globalRow,
            col:globalCol,
            epsg:analysisEpsg,
            classCode:Math.round(Number(raw)),
            classKey,
            areaM2:area,
            center,
            quadWgs:[[c0.lon,c0.lat],[c1.lon,c1.lat],[c2.lon,c2.lat],[c3.lon,c3.lat]],
            source:src.key
          });
        }
      }
      if(runStart>=0){
        dgLcRunPush(runs,globalRow,runStart,colStart+localW,runCls,meta,analysisEpsg);
        runStart=-1;runCls=null;
      }
    }

    return{
      source:src.key,
      epsg:analysisEpsg,
      rasterEpsg,
      sourceCells,
      assignedAreaM2,
      classifiedAreaM2,
      maskedAreaM2,
      maskedCount,
      groupCounts,
      groupAreas,
      rawCounts,
      rawAreas,
      runs,
      cells
    };
  });
}

function dgLcMergeTileResults(parts){
  const outGroupCounts={},outGroupAreas={},outRawCounts={},outRawAreas={};
  const runs=[];
  const cells=[];
  let assigned=0,classified=0,masked=0,maskedCount=0,sourceCells=0;
  for(const p of parts){
    assigned+=p.assignedAreaM2;
    classified+=p.classifiedAreaM2;
    masked+=p.maskedAreaM2;
    maskedCount+=p.maskedCount||0;
    sourceCells+=p.sourceCells;
    for(const [k,v] of Object.entries(p.groupCounts||{}))outGroupCounts[k]=(outGroupCounts[k]||0)+v;
    for(const [k,v] of Object.entries(p.groupAreas||{}))outGroupAreas[k]=(outGroupAreas[k]||0)+v;
    for(const [k,v] of Object.entries(p.rawCounts||{}))outRawCounts[k]=(outRawCounts[k]||0)+v;
    for(const [k,v] of Object.entries(p.rawAreas||{}))outRawAreas[k]=(outRawAreas[k]||0)+v;
    runs.push(...(p.runs||[]));
    if(cells.length<10000)cells.push(...(p.cells||[]));
  }
  return{
    assignedAreaM2:assigned,
    classifiedAreaM2:classified,
    maskedAreaM2:masked,
    maskedCount,
    sourceCells,
    groupCounts:outGroupCounts,
    groupAreas:outGroupAreas,
    rawCounts:outRawCounts,
    rawAreas:outRawAreas,
    runs,
    cells
  };
}

/* Nesneleri YUMUŞAK VEKTÖR POLİGONLAR olarak çizer.
 * Eskiden run bantları (dikdörtgen şeritler) çiziliyordu ve kullanıcı
 * "kare kare" görüyordu. Artık her nesne: sınır izi → halkalar (delikli)
 * → Chaikin yumuşatma → tek L.polygon. */
function dgLcRenderObjects(patches){
  if(DG_LC_LAYER&&typeof map!=="undefined"&&map){
    map.removeLayer(DG_LC_LAYER);
    DG_LC_LAYER=null;
  }
  if(typeof map==="undefined"||!map||!window.L)return;
  if(!patches||!patches.length)return;
  const renderer=(typeof L.canvas==="function")?L.canvas({padding:.2}):null;
  DG_LC_LAYER=L.layerGroup().addTo(map);
  for(const pt of patches){
    const cls=DG_LC_CLASSES.find(c=>c.key===(pt.classKey||pt.group));
    if(!cls||!pt.rings||!pt.rings.length)continue;
    const latlngs=pt.rings.map(ring=>ring.map(p=>[p[0],p[1]]));
    L.polygon(latlngs,{
      color:cls.color,
      weight:1.1,
      opacity:.60,
      fillColor:cls.color,
      fillOpacity:.38,
      interactive:false,
      renderer:renderer||undefined
    }).addTo(DG_LC_LAYER);
  }
}

function dgLcClearLayer(){
  if(DG_LC_LAYER&&typeof map!=="undefined"&&map){
    map.removeLayer(DG_LC_LAYER);
  }
  DG_LC_LAYER=null;
}

/* TEK BLOK rapor: kullanıcı isteği (2026-09-20) — "1 tane barlı ver ve
 * gerekli bilgileri içersin". Sınıf başına TEK satır: bar + ha + % ve alt
 * satırda gerekli ayrıntılar (hücre sayısı, çapraz uzlaşma, nesne özeti).
 * Ayrı sınıf tablosu / çapraz tablo / nesne tablosu YOK — hepsi bu blokta. */
function dgLcRenderReport(rep,result,parkAreaM2,extra){
  if(!rep)return;
  const R=result.groupAreas?result:{
    groupCounts:result.groupCounts||{},
    groupAreas:result.groupAreasM2||{},
    rawCounts:result.rawCounts||{},
    rawAreas:result.rawAreasM2||{},
    classifiedAreaM2:result.classifiedAreaM2||0,
    maskedAreaM2:result.maskedAreaM2||0,
    maskedCount:result.maskedCount||0,
    sourceCells:result.sourceCells||0,
    assignedAreaM2:result.rasterCoverageAreaM2||result.assignedAreaM2||0,
    cells:result.cells,
    runs:result.runs
  };
  const last=(typeof DG_LC_LAST!=="undefined"&&DG_LC_LAST&&DG_LC_LAST.report)?DG_LC_LAST.report:null;
  const exSrc=extra||(result.agreement||result.patches?result:last)||{};
  const ex={
    primaryYear:exSrc.primaryYear!=null?exSrc.primaryYear:exSrc.year,
    primaryLabel:exSrc.primaryLabel,
    primaryCitation:exSrc.primaryCitation,
    crossCitation:exSrc.crossCitation,
    agreement:exSrc.agreement,
    crossError:exSrc.crossError,
    patches:exSrc.patches
  };
  const analysisArea=R.assignedAreaM2;
  const GROUP_ORDER=["green","water","hard","bare","other"];

  const patchesBy={};
  for(const pt of (ex.patches||[])){
    const k=pt.classKey||pt.group;
    (patchesBy[k]=patchesBy[k]||[]).push(pt);
  }

  const aktif=GROUP_ORDER.filter(k=>(R.groupAreas?.[k]||0)>0);
  const max=aktif.length?Math.max(...aktif.map(k=>R.groupAreas[k])):1;

  const rowsHtml=aktif.map(k=>{
    const cls=DG_LC_CLASSES.find(c=>c.key===k);
    const area=R.groupAreas[k]||0;
    const count=R.groupCounts?.[k]||0;
    const pct=analysisArea>0?area/analysisArea*100:0;
    const w=max>0?Math.max(2,area/max*100):0;
    const ag=ex.agreement?.[k];
    const pl=patchesBy[k];
    const sub=[
      count.toLocaleString("tr-TR")+" hücre",
      ag?("🔬 uzlaşma %"+ag.agreementPct.toFixed(0)):null,
      pl&&pl.length?("🧩 "+pl.length+" nesne · en büyük "+
        Math.max(...pl.map(p=>p.areaHa!=null?p.areaHa:(p.areaM2||0)/10000)).toFixed(2)+" ha"):null
    ].filter(Boolean).join(" · ");
    return"<div style='margin:8px 0'>"+
      "<div style='display:flex;align-items:center;gap:8px'>"+
        "<div style='flex:0 0 106px;font-size:.75rem;font-weight:700'>"+cls.emoji+" "+cls.label+"</div>"+
        "<div style='flex:1;height:16px;background:rgba(20,30,25,.06);border-radius:8px;overflow:hidden'>"+
          "<div style='height:100%;width:"+w.toFixed(1)+"%;background:"+cls.color+"66;border:1px solid "+cls.color+";border-radius:8px'></div>"+
        "</div>"+
        "<div class='mono' style='flex:0 0 108px;text-align:right;font-size:.75rem;font-weight:600'>"+
          (area/10000).toFixed(2)+" ha <span style='color:var(--mut);font-weight:400'>%"+pct.toFixed(1)+"</span></div>"+
      "</div>"+
      "<div style='margin:2px 0 0 114px;font-size:.66rem;color:var(--mut)'>"+sub+"</div>"+
    "</div>";
  }).join("");

  const maskedPct=analysisArea>0?R.maskedAreaM2/analysisArea*100:0;
  const areaDeltaPct=parkAreaM2>0?Math.abs(analysisArea-parkAreaM2)/parkAreaM2*100:0;
  const qaOk=areaDeltaPct<=0.5;
  const maskNote=R.maskedAreaM2>0
    ?"<div style='margin-top:8px;padding:7px 10px;border-radius:8px;background:rgba(245,158,11,.10);color:#92400e;font-size:.67rem'>⚠ Veri dışı/maskeli alan: <b>"+(R.maskedAreaM2/10000).toFixed(2)+" ha</b> (%"+maskedPct.toFixed(1)+").</div>"
    :"";

  rep.innerHTML=
    "<b>🗺️ Arazi Örtüsü · 10 m · "+(ex.primaryYear||2021)+"</b>"+
    "<div style='font-size:.67rem;color:var(--mut);margin:5px 0 2px'>"+
      (ex.primaryLabel||"")+
      " · <span style='color:"+(qaOk?"var(--green-dk)":"#991b1b")+"'>"+
      (qaOk?"✓ geometrik QA geçti (%"+areaDeltaPct.toFixed(2)+" fark)":"⚠ QA farkı %"+areaDeltaPct.toFixed(2))+
      "</span></div>"+
    "<div style='margin:6px 0 4px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg)'>"+
      rowsHtml+
    "</div>"+
    maskNote+
    "<div style='font-size:.66rem;color:var(--mut);margin-top:8px'>"+
      "<b>Park:</b> "+(parkAreaM2/10000).toFixed(2)+" ha · "+
      "<b>Analiz:</b> "+(analysisArea/10000).toFixed(2)+" ha · "+
      "<b>Hücre:</b> "+R.sourceCells.toLocaleString("tr-TR")+" · "+
      "<b>Kapsam:</b> %"+(analysisArea>0?R.classifiedAreaM2/analysisArea*100:0).toFixed(1)+
    "</div>"+
    "<div style='font-size:.64rem;color:var(--mut);margin-top:4px'>"+
      "Kaynaklar: "+(ex.primaryCitation||"")+(ex.crossCitation?" + "+ex.crossCitation:"")+
      (ex.crossError?" · çapraz kaynak atlandı":"")+
    "</div>"+
    "<div style='display:flex;gap:7px;flex-wrap:wrap;margin-top:10px'>"+
      "<button class='btn sm ghost' onclick='downloadLandCoverClassCSV()'>📥 Sınıf CSV</button>"+
      "<button class='btn sm ghost' onclick='downloadLandCoverCellsGeoJSON()'>📍 Hücre GeoJSON</button>"+
    "</div>";
}

function dgLcClassCsv(result,meta){
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const m=meta||{};
  const rows=[["CLASS","GROUP","SOURCE_CELL_COUNT","AREA_HA","PERCENT_OF_ANALYSIS_AREA","YEAR","RESOLUTION_M","SOURCE"]];
  const denominator=result.assignedAreaM2;
  const GROUP_ORDER=["green","water","hard","bare","other"];
  for(const k of GROUP_ORDER){
    const cls=DG_LC_CLASSES.find(c=>c.key===k);
    const count=result.groupCounts?.[k]||0;
    const area=result.groupAreas?.[k]||0;
    if(!count&&!area)continue;
    rows.push([
      q(cls.label),q(k),count,
      (area/10000).toFixed(4),
      denominator>0?(area/denominator*100).toFixed(4):"0",
      m.year||"",m.resolutionM||10,q(m.primaryLabel||"")
    ]);
  }
  /* Ham kaynak kod kırılımı — bilimsel şeffaflık */
  for(const code of Object.keys(result.rawCounts||{}).sort((a,b)=>Number(a)-Number(b))){
    const count=result.rawCounts[code];
    if(!count)continue;
    rows.push([
      q("RAW kod "+code),q("raw"),count,
      ((result.rawAreas?.[code]||0)/10000).toFixed(4),
      denominator>0?((result.rawAreas?.[code]||0)/denominator*100).toFixed(4):"0",
      m.year||"",m.resolutionM||10,q(m.primaryLabel||"")
    ]);
  }
  rows.push([
    q("MASKELİ / NODATA"),q("masked"),result.maskedCount||0,
    (result.maskedAreaM2/10000).toFixed(4),
    denominator>0?(result.maskedAreaM2/denominator*100).toFixed(4):"0",
    m.year||"",m.resolutionM||10,q(m.primaryLabel||"")
  ]);
  return"\uFEFF"+rows.map(r=>r.join(",")).join("\n")+"\n";
}

function dgLcCellsGeoJson(result){
  const features=(result.cells||[]).map((c,i)=>{
    const ring=c.quadWgs&&c.quadWgs.length===4
      ?[...c.quadWgs,c.quadWgs[0]]
      :[[c.center.lon,c.center.lat],[c.center.lon,c.center.lat]];
    return{
      type:"Feature",
      properties:{
        cell_id:i+1,
        row:c.row,
        column:c.col,
        class_code:c.classCode,
        class_name:(DG_ESA_CODES[c.classCode]||DG_LC_CODES[c.classCode]||"Bilinmeyen"),
        group:c.classKey,
        intersection_area_m2:+Number(c.areaM2||0).toFixed(4),
        center_lat:+c.center.lat.toFixed(7),
        center_lon:+c.center.lon.toFixed(7),
        source:c.source||""
      },
      geometry:{
        type:"Polygon",
        coordinates:[ring]
      }
    };
  });
  return{
    type:"FeatureCollection",
    name:"dendrogeo_10m_landcover",
    features
  };
}

/* ---------- Nesne tanımlama: bağlantılı bileşenler ----------
 * Aynı sınıfa ait bitişik (4-yön) 10 m hücreleri tek bir "nesne" sayılır:
 * göl, çayır bloğu, yapılı alan parçası... Her bileşen için alan ve
 * alan-ağırlıklı merkez üretilir. Park ölçeğinde "kaç su kütlesi var,
 * en büyük yeşil blok nerede?" sorularının cevabıdır. */
function dgLcDetectPatches(cells,minHa){
  const threshold=(minHa==null?0.05:minHa)*10000;
  const key=c=>c.epsg+":"+c.row+":"+c.col;
  const grid=new Map();
  for(const c of cells)grid.set(key(c),c);
  const seen=new Set();
  const patches=[];
  for(const c of cells){
    const k0=key(c);
    if(seen.has(k0))continue;
    seen.add(k0);
    const stack=[c];
    const comp=[c];
    while(stack.length){
      const cur=stack.pop();
      const nb=[[1,0],[-1,0],[0,1],[0,-1]];
      for(const [dr,dc] of nb){
        const nk=cur.epsg+":"+(cur.row+dr)+":"+(cur.col+dc);
        const n=grid.get(nk);
        if(n&&!seen.has(nk)&&n.classKey===cur.classKey){
          seen.add(nk);
          stack.push(n);
          comp.push(n);
        }
      }
    }
    const area=comp.reduce((t,x)=>t+(x.areaM2||0),0);
    if(area<threshold)continue;
    let wl=0,wo=0;
    for(const x of comp){wl+=x.center.lat*(x.areaM2||0);wo+=x.center.lon*(x.areaM2||0);}
    /* Görsel katman için vektör halkalar: kare kare değil, yumuşak çizim.
     * Rapor sayılarına dokunmaz (alan hücre kesişiminden gelir). */
    let rings=[],ringsRaw=[];
    try{
      ringsRaw=dgLcPatchRings(comp);
      /* Yumuşatma köşeleri kestiği için halkayı bir miktar içe büker;
       * komşu nesnelerin sınırları birbirinden uzaklaşmış görünüyordu
       * (kullanıcı geri bildirimi 2026-09-20). Çözüm: TEK tur Chaikin +
       * alan geri ölçekleme — yumuşak çizgi, gerçek boyut, bitişik sınırlar
       * tekrar birbirine değer. */
      rings=ringsRaw.map(r=>{
        const sm=dgLcSmoothRing(r,1);
        const a0=Math.abs(dgLcRingArea(r)),a1=Math.abs(dgLcRingArea(sm));
        if(!(a0>0)||!(a1>0))return sm;
        const f=Math.sqrt(a0/a1);
        if(!Number.isFinite(f)||f<=1||f>1.5)return sm;
        const c=dgLcRingCentroid(sm);
        return sm.map(pt=>[c[0]+(pt[0]-c[0])*f,c[1]+(pt[1]-c[1])*f]);
      });
    }catch(err){
      console.warn("DENDROGEO · nesne halkası kurulamadı, atlandı:",err);
    }
    patches.push({
      classKey:comp[0].classKey,
      areaM2:area,
      cells:comp.length,
      centroid:{lat:wl/area,lon:wo/area},
      rings,
      ringsRaw
    });
  }
  patches.sort((a,b)=>b.areaM2-a.areaM2);
  return patches;
}

/* ---------- Piksel yığınını vektör halkalara çevir ----------
 * Kare kare bant çizimi yerine: bir nesnenin (bağlantılı bileşen) hücre
 * kümesinden SINIR İZİ çıkarılır → dış halka + delikler → Chaikin ile
 * yumuşatılır. Sonuç haritada "gerçek çizim" gibi organik bir poligon
 * olarak görünür. Sayısal hesaplar DEĞİŞMEZ (hâlâ tam hücre kesişimi);
 * bu yalnızca görsel katman.
 *
 * Yöntem:
 *  · her hücrenin 4 komşusuna bakılır; komşu nesneye ait değilse o kenar
 *    SINIR kenarıdır ve bölgeyi tutarlı yönde dolaşan yönlü doğru parçası
 *    olarak eklenir (paylaşılan kenarlar zaten hiç üretilmez)
 *  · köşe noktaları zincirlenerek kapalı halkalar kurulur
 *  · halkalar lat/lon'a çevrilir; işaretli alanla dış halka / delik ayrımı
 *    yapılır, delikler dış halkanın içine yuvalanır (Leaflet hole sözdizimi)
 *  · Chaikin (2 tur) köşeleri yumuşatır */
function dgLcPatchRings(cells){
  const key=c=>c.row+":"+c.col;
  const set=new Set(cells.map(key));
  const byKey=new Map(cells.map(c=>[key(c),c]));
  /* köşe(r,c) → lat/lon: köşeye bitişik herhangi bir hücrenin quadWgs'inden */
  const corner=(r,c)=>{
    const src=byKey.get(r+":"+c)||byKey.get((r-1)+":"+c)||byKey.get(r+":"+ (c-1))||byKey.get((r-1)+":"+(c-1));
    if(!src)return null;
    // hücre (sr,sc) quadWgs: [0]=(lon0,latBot) [1]=(lon1,latBot) [2]=(lon1,latTop) [3]=(lon0,latTop)
    const dr=r-src.row,dc=c-src.col;
    if(dr===0&&dc===0)return src.quadWgs[3];
    if(dr===0&&dc===1)return src.quadWgs[2];
    if(dr===1&&dc===1)return src.quadWgs[1];
    if(dr===1&&dc===0)return src.quadWgs[0];
    return null;
  };
  const edges=[];   // [ [r,c], [r2,c2] ] yönlü köşe çiftleri
  for(const c of cells){
    const r=c.row,cc=c.col;
    if(!set.has((r-1)+":"+cc))edges.push([[r,cc],[r,cc+1]]);       // kuzey
    if(!set.has(r+":"+(cc+1)))edges.push([[r,cc+1],[r+1,cc+1]]);    // doğu
    if(!set.has((r+1)+":"+cc))edges.push([[r+1,cc+1],[r+1,cc]]);    // güney
    if(!set.has(r+":"+(cc-1)))edges.push([[r+1,cc],[r,cc]]);        // batı
  }
  const startMap=new Map();
  for(const e of edges){
    const k=e[0][0]+","+e[0][1];
    if(!startMap.has(k))startMap.set(k,[]);
    startMap.get(k).push(e);
  }
  const used=new Set();
  const ringsGrid=[];
  for(let i=0;i<edges.length;i++){
    if(used.has(i))continue;
    const ring=[edges[i][0]];
    used.add(i);
    let cur=edges[i][1];
    let guard=0;
    while(guard++<edges.length+1){
      ring.push(cur);
      const k=cur[0]+","+cur[1];
      const opts=startMap.get(k)||[];
      let next=null,nextIdx=-1;
      for(const o of opts){
        const idx=edges.indexOf(o);
        if(!used.has(idx)){next=o;nextIdx=idx;break;}
      }
      if(nextIdx<0)break;
      used.add(nextIdx);
      cur=next[1];
      if(cur[0]===ring[0][0]&&cur[1]===ring[0][1])break;
    }
    /* kapanışta başlangıç köşesi çift yazılmışsa tekilleştir —
     * sonst sadeleştirme adımı köşeyi yutuyor ve halka alanı küçülüyordu */
    if(ring.length>1&&ring[ring.length-1][0]===ring[0][0]&&ring[ring.length-1][1]===ring[0][1])ring.pop();
    if(ring.length>=4)ringsGrid.push(ring);
  }
  /* grid köşelerinden lat/lon halkalarına */
  const rings=[];
  for(const rg of ringsGrid){
    const pts=[];
    for(const [r,c] of rg){
      const w=corner(r,c);
      if(!w)continue;
      const last=pts[pts.length-1];
      if(last&&last[0]===w[1]&&last[1]===w[0])continue;   // tekrar köşeyi at
      pts.push([w[1],w[0]]);                               // [lat,lon]
    }
    if(pts.length>=3){
      // doğrusal ardışık noktaları sadeleştir
      const simp=[];
      for(let i=0;i<pts.length;i++){
        const a=pts[(i-1+pts.length)%pts.length],b=pts[i],c2=pts[(i+1)%pts.length];
        const cross=(b[0]-a[0])*(c2[1]-b[1])-(b[1]-a[1])*(c2[0]-b[0]);
        /* doğrusal (collinear) ara köşeleri at: yalnızca yön değişimi kalan
         * köşeler korunur; sonst kare halka 12 noktayla gereksiz şişer */
        if(Math.abs(cross)>1e-12)simp.push(b);
      }
      if(simp.length>=3)rings.push(simp);
    }
  }
  if(!rings.length)return[];
  /* dış halka / delik ayrımı: işaretli alan (lon,lat düzleminde) */
  const signed=r=>{
    let a=0;
    for(let i=0;i<r.length;i++){
      const p=r[i],q=r[(i+1)%r.length];
      a+=p[1]*q[0]-q[1]*p[0];
    }
    return a/2;
  };
  const withSign=rings.map(r=>({pts:r,a:signed(r)}));
  withSign.sort((x,y)=>Math.abs(y.a)-Math.abs(x.a));
  const outer=withSign[0];
  const holes=withSign.slice(1).filter(h=>Math.sign(h.a)!==Math.sign(outer.a));
  return [outer.pts,...holes.map(h=>h.pts)];
}

/* Halka alanı (derece düzleminde shoelace) ve merkez — alan geri ölçekleme için. */
function dgLcRingArea(ring){
  let a=0;
  for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length];
    a+=p[0]*q[1]-q[0]*p[1];
  }
  return a/2;
}
function dgLcRingCentroid(ring){
  let x=0,y=0;
  for(const p of ring){x+=p[0];y+=p[1];}
  return [x/ring.length,y/ring.length];
}
/* Chaikin yumuşatma: kapalı halkada her kenarı 25/75 noktalarıyla değiştirir.
 * YALNIZCA GÖRSEL katman; rapor sayılarına dokunmaz. */
function dgLcSmoothRing(ring,iters){
  let pts=ring.slice();
  const n=iters==null?1:iters;
  for(let k=0;k<n&&pts.length>=4;k++){
    const out=[];
    for(let i=0;i<pts.length;i++){
      const p=pts[i],q=pts[(i+1)%pts.length];
      out.push([0.75*p[0]+0.25*q[0],0.75*p[1]+0.25*q[1]]);
      out.push([0.25*p[0]+0.75*q[0],0.25*p[1]+0.75*q[1]]);
    }
    pts=out;
  }
  return pts;
}

/* Nokta halka içinde mi (ışın yöntemi, [lat,lon] halkaları). */
function dgLcPointInRing(lat,lon,ring){
  let ic=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const yi=ring[i][0],xi=ring[i][1],yj=ring[j][0],xj=ring[j][1];
    if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)ic=!ic;
  }
  return ic;
}
/* Nokta dış halka içinde ve deliklerde değil mi? */
function dgLcPointInRings(lat,lon,rings){
  if(!rings||!rings.length)return false;
  if(!dgLcPointInRing(lat,lon,rings[0]))return false;
  for(let i=1;i<rings.length;i++){
    if(dgLcPointInRing(lat,lon,rings[i]))return false;
  }
  return true;
}
/* Bir koordinat LULC analizine göre YEŞİL nesne içinde mi?
 * Grid sistemi bunu kullanır: ölçüm hücreleri yalnız yeşil alanda kurulur.
 * Ham (yumuşatılmamış) halkalar kullanılır — hassasiyet için. */
function dgLcIsGreen(lat,lon){
  const last=DG_LC_LAST;
  if(!last||!last.patches)return false;
  for(const pt of last.patches){
    if((pt.classKey||pt.group)!=="green")continue;
    if(dgLcPointInRings(lat,lon,pt.ringsRaw||pt.rings))return true;
  }
  return false;
}
function dgLcHasGreen(){
  const last=DG_LC_LAST;
  return !!(last&&last.patches&&last.patches.some(p=>(p.classKey||p.group)==="green"));
}

/* Yapay su havuzları / göletler: ESA WorldCover bunları sıklıkla "yapılı alan"
 * sayar (Gençlik Parkı, Millet Bahçesi havuzları gibi — kullanıcı bildirimi).
 * OSM'de bu havuzlar natural=water / leisure=swimming_pool olarak çizilidir.
 * Park bbox'ı için OSM su poligonları çekilir ve hücre merkezleri içinde
 * kalanlar SU sınıfına geçirilir. Böylece yapay havuzlar su alanına katılır. */
const DG_OSM_WATER_MIRRORS=[
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter"
];
async function dgLcFetchWaterPolygons(bbox){
  const b=[bbox.minLat,bbox.minLon,bbox.maxLat,bbox.maxLon].join(",");
  const sel="(nwr[\"natural\"=\"water\"]("+b+");nwr[\"waterway\"=\"riverbank\"]("+b+");"+
             "nwr[\"leisure\"=\"swimming_pool\"]("+b+");nwr[\"landuse\"=\"basin\"]("+b+"););";
  const q="[out:json][timeout:60];"+sel+"out geom;";
  let data=null;
  for(const url of DG_OSM_WATER_MIRRORS){
    try{
      const r=await fetch(url,{
        method:"POST",
        headers:{
          "Content-Type":"application/x-www-form-urlencoded",
          "User-Agent":"dendrogeo-lulc-qa/1.0 (scientific QA tool)",
          "Accept":"application/json"
        },
        body:"data="+encodeURIComponent(q),
        signal:AbortSignal.timeout(45000)
      });
      if(!r.ok)continue;
      data=await r.json();
      break;
    }catch(err){/* sonraki ayna */}
  }
  const rings=[];
  for(const el of (data&&data.elements)||[]){
    if(el.type==="way"&&el.geometry&&el.geometry.length>=3){
      rings.push(el.geometry.map(g=>[g.lat,g.lon]));
    }else if(el.type==="relation"&&el.members){
      const outer=el.members.filter(m=>m.role==="outer"||m.role==="");
      const ring=[];
      for(const m of outer)for(const g of (m.geometry||[]))ring.push([g.lat,g.lon]);
      if(ring.length>=3)rings.push(ring);
    }
  }
  return rings;
}
/* Hücreleri OSM su poligonlarına göre SU sınıfına geçirir.
 * Dönen değer: değiştirilen hücre sayısı. Grup sayaçları/alanları ve
 * maskeli alan tutarlı şekilde güncellenir; ham kaynak kod kırılımı
 * (rawCounts) ESA'nın kendi çıktısı olarak DOKUNULMADAN kalır. */
function dgLcRefineWater(result,waterRings){
  if(!waterRings||!waterRings.length)return 0;
  let n=0;
  for(const cell of (result.cells||[])){
    if(cell.classKey==="water")continue;
    const lat=cell.center.lat,lon=cell.center.lon;
    let inWater=false;
    for(const rg of waterRings){
      if(dgLcPointInRing(lat,lon,rg)){inWater=true;break;}
    }
    if(!inWater)continue;
    const a=cell.areaM2||0;
    const old=cell.classKey;
    if(old){
      result.groupCounts[old]=Math.max(0,(result.groupCounts[old]||1)-1);
      result.groupAreas[old]=Math.max(0,(result.groupAreas[old]||a)-a);
    }else{
      result.maskedCount=Math.max(0,(result.maskedCount||1)-1);
      result.maskedAreaM2=Math.max(0,(result.maskedAreaM2||a)-a);
      result.classifiedAreaM2=(result.classifiedAreaM2||0)+a;
    }
    result.groupCounts.water=(result.groupCounts.water||0)+1;
    result.groupAreas.water=(result.groupAreas.water||0)+a;
    cell.classKey="water";
    cell.classCode=80;
    cell.waterRefined=true;
    n++;
  }
  return n;
}

/* ---------------------------------------------------------------------------
 * OSM YOL RAFİNASYONU
 *
 * 10 m tematik raster, dar/uzun asfalt yolları tek bir piksel içinde
 * vejetasyonla karıştırabilir. Bu özellikle park içindeki asfalt servis
 * yollarında "yeşil / çıplak / sert" şeklinde parçalı sonuç üretir.
 *
 * Burada OSM yalnızca açıkça yol olan geometriler için bağımsız vektör
 * kanıtıdır. Rasterın ham kodları (rawCounts/rawAreas) değiştirilmez.
 * Hücre sınıfı yalnızca yol geometrisi hücreyle gerçekten kesişiyorsa
 * "hard" yapılır. Böylece sabit hedef alan veya katsayı kullanılmaz.
 *
 * Önemli ayrım:
 *   - motorlu/servis yol sınıfları: surface etiketi olmasa da yol olarak
 *     sert kabul edilir;
 *   - footway/path/cycleway/steps gibi yaya geometrileri: yalnızca
 *     surface=asphalt/paved/concrete/... açıkça sert ise override edilir.
 *     Böylece doğal toprak patikalar otomatik olarak asfalt sayılmaz.
 * ------------------------------------------------------------------------- */

function dgLcRoadSurfaceIsHard(surface){
  const s=String(surface||"").toLowerCase().trim();
  return[
    "asphalt",
    "paved",
    "concrete",
    "concrete:plates",
    "concrete:lanes",
    "paving_stones",
    "sett",
    "cobblestone",
    "unhewn_cobblestone",
    "bricks"
  ].includes(s);
}

function dgLcRoadNumber(v){
  const n=parseFloat(String(v??"").replace(",",".").replace(/[^0-9.+-]/g,""));
  return Number.isFinite(n)&&n>0?n:null;
}

function dgLcRoadHalfWidth(tags){
  const t=tags||{};
  const explicit=dgLcRoadNumber(t.width);
  if(explicit)return Math.max(0.75,explicit/2);

  const lanes=dgLcRoadNumber(t.lanes);
  if(lanes)return Math.max(1.5,lanes*3/2);

  const hw=String(t.highway||"").toLowerCase();
  const defaults={
    motorway:7,
    trunk:6.5,
    primary:6,
    secondary:6,
    tertiary:5.5,
    unclassified:5,
    residential:5,
    living_street:4,
    service:4,
    track:3,
    pedestrian:2,
    footway:1.75,
    path:1.5,
    cycleway:1.5,
    steps:1.5,
    bridleway:1.5
  };
  return defaults[hw]||2;
}

function dgLcRoadShouldRefine(tags){
  const t=tags||{};
  const hw=String(t.highway||"").toLowerCase();
  if(!hw)return false;

  /* Araç/servis yolları açıkça yol geometrisidir. */
  if([
    "motorway","trunk","primary","secondary","tertiary",
    "unclassified","residential","living_street","service"
  ].includes(hw)){
    return true;
  }

  /* Yaya/bisiklet yollarında yalnız açık yüzey etiketi sert kanıt sayılır. */
  return dgLcRoadSurfaceIsHard(t.surface);
}

async function dgLcFetchRoadFeatures(bbox){
  const b=[bbox.minLat,bbox.minLon,bbox.maxLat,bbox.maxLon].join(",");
  const q=
    "[out:json][timeout:60];("+
    "way[\\\"highway\\\"]("+b+");"+
    "way[\\\"area:highway\\\"]("+b+");"+
    ");out tags geom;";

  let data=null;
  for(const url of DG_OSM_WATER_MIRRORS){
    try{
      const r=await fetch(url,{
        method:"POST",
        headers:{
          "Content-Type":"application/x-www-form-urlencoded",
          "User-Agent":"dendrogeo-lulc-qa/1.0 (scientific QA tool)",
          "Accept":"application/json"
        },
        body:"data="+encodeURIComponent(q),
        signal:AbortSignal.timeout(45000)
      });
      if(!r.ok)continue;
      const j=await r.json();
      if(j&&Array.isArray(j.elements)){
        data=j;
        break;
      }
    }catch(err){/* sonraki ayna */}
  }

  const features=[];
  for(const el of (data&&data.elements)||[]){
    if(el?.type!=="way"||!Array.isArray(el.geometry)||el.geometry.length<2)continue;
    const tags=el.tags||{};
    if(!dgLcRoadShouldRefine(tags))continue;

    const pts=el.geometry
      .filter(g=>Number.isFinite(Number(g?.lat))&&Number.isFinite(Number(g?.lon)))
      .map(g=>[Number(g.lat),Number(g.lon)]);

    if(pts.length<2)continue;

    const isArea=String(tags["area:highway"]||"").toLowerCase()==="yes";
    features.push({
      pts,
      area:isArea||(
        pts.length>=4 &&
        pts[0][0]===pts[pts.length-1][0] &&
        pts[0][1]===pts[pts.length-1][1]
      ),
      halfWidth:dgLcRoadHalfWidth(tags),
      highway:String(tags.highway||""),
      surface:String(tags.surface||"")
    });
  }

  return features;
}

function dgLcPointSegmentDistanceXY(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx===0&&dy===0){
    return Math.hypot(p.x-a.x,p.y-a.y);
  }
  const t=Math.max(0,Math.min(1,
    ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)
  ));
  return Math.hypot(
    p.x-(a.x+t*dx),
    p.y-(a.y+t*dy)
  );
}

function dgLcRoadTouchesCell(feature,cell,epsg){
  const pts=feature.pts||[];
  if(pts.length<2)return false;

  /* Hücre köşeleri zaten analiz UTM'sinde tutuluyor. */
  const quadWgs=cell.quadWgs||[];
  if(quadWgs.length<4)return false;

  const quad=quadWgs.map(p=>{
    const z=dgLcUtmForward(Number(p[1]),Number(p[0]),epsg);
    return{x:z.x,y:z.y};
  });

  const center={
    x:(quad[0].x+quad[1].x+quad[2].x+quad[3].x)/4,
    y:(quad[0].y+quad[1].y+quad[2].y+quad[3].y)/4
  };

  const road=pts.map(p=>{
    const z=dgLcUtmForward(p[0],p[1],epsg);
    return{x:z.x,y:z.y};
  });

  /* area:highway poligonuysa merkez/köşe testi yeterlidir. */
  if(feature.area){
    const inside=p=>{
      let hit=false;
      for(let i=0,j=quad.length-1;i<quad.length;j=i++){
        const a=quad[i],b=quad[j];
        if(((a.y>p.y)!==(b.y>p.y))&&
          p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x){
          hit=!hit;
        }
      }
      return hit;
    };

    for(const p of road){
      if(inside(p))return true;
    }
    for(const p of quad){
      /* yol poligonunun içinde hücre köşesi */
      let hit=false;
      for(let i=0,j=road.length-1;i<road.length;j=i++){
        const a=road[i],b=road[j];
        if(((a.y>p.y)!==(b.y>p.y))&&
          p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x){
          hit=!hit;
        }
      }
      if(hit)return true;
    }
    return false;
  }

  /* Çizgisel yol: yol merkez hattı + gerçek/genel genişlik.
   * Hücre yarıçapı, 10 m raster hücresinin en uzak köşesine kadar
   * ulaşabilecek tamponu temsil eder. */
  let halfDiag=0;
  for(const p of quad){
    halfDiag=Math.max(halfDiag,Math.hypot(p.x-center.x,p.y-center.y));
  }
  const reach=feature.halfWidth+halfDiag;

  for(let i=0;i<road.length-1;i++){
    if(dgLcPointSegmentDistanceXY(center,road[i],road[i+1])<=reach){
      return true;
    }
  }

  return false;
}

function dgLcRefineHardByOsm(result,roadFeatures,epsg){
  if(!result||!Array.isArray(result.cells)||!roadFeatures?.length)return 0;

  let changed=0;
  for(const cell of result.cells){
    /* OSM yolu su pikselinin üzerine bindiyse suyu ezme. */
    if(cell.classKey==="water")continue;

    let road=false;
    for(const feature of roadFeatures){
      if(dgLcRoadTouchesCell(feature,cell,epsg)){
        road=true;
        break;
      }
    }
    if(!road)continue;

    const a=Number(cell.areaM2||0);
    if(!(a>0))continue;

    const old=cell.classKey;
    if(old==="hard")continue;

    if(old){
      result.groupCounts[old]=Math.max(0,(result.groupCounts[old]||1)-1);
      result.groupAreas[old]=Math.max(0,(result.groupAreas[old]||a)-a);
    }else{
      result.maskedCount=Math.max(0,(result.maskedCount||1)-1);
      result.maskedAreaM2=Math.max(0,(result.maskedAreaM2||a)-a);
      result.classifiedAreaM2=(result.classifiedAreaM2||0)+a;
    }

    result.groupCounts.hard=(result.groupCounts.hard||0)+1;
    result.groupAreas.hard=(result.groupAreas.hard||0)+a;
    cell.classKey="hard";
    cell.classCode=50;
    cell.roadRefined=true;
    changed++;
  }

  return changed;
}

/* İki kaynağın grup alanları arasındaki uzlaşma (belirsizlik göstergesi) */
function dgLcGroupAgreement(a,b){
  const out={};
  for(const k of ["green","water","hard","bare","other"]){
    const av=a.groupAreas?.[k]||0;
    const bv=b.groupAreas?.[k]||0;
    const tot=av+bv;
    out[k]={
      primaryHa:av/10000,
      crossHa:bv/10000,
      agreementPct:tot>0?Math.max(0,100*(1-Math.abs(av-bv)/tot)):100
    };
  }
  return out;
}

/* Tek kaynak için tam analiz zinciri */
async function dgLcAnalyzeSource(src,bbox,geom){
  /* STAC karo listesi ile SAS tokenı birbirinden bağımsızdır: aynı anda
   * istenmesi mobil bağlantıda gereksiz beklemeyi azaltır. */
  const [items,token]=await Promise.all([
    dgLcFindTiles(bbox,src),
    dgLcGetSas(src.collection)
  ]);

  if(items.length>DG_LC_MAX_TILES){
    throw new Error("AOI çok sayıda 10 m veri karosuna taşıyor; analiz güvenliği nedeniyle durduruldu.");
  }

  const parts=[];
  const seen=new Set();
  const jobs=[];
  for(const item of items){
    if(seen.has(item.id))continue;
    seen.add(item.id);
    const asset=dgLcGetDataAsset(item,src);
    if(!asset?.href)throw new Error(src.year+" veri karosunun COG asset'i bulunamadı: "+item.id);
    const href=dgLcSignedHref(asset.href,token);
    jobs.push(dgLcProcessTile(item,href,geom,src));
  }
  /* Kesişen karolar bağımsızdır; seri GeoTIFF okuması yerine paralel
   * işlenir. Sonuçların birleştirilmesi deterministiktir. */
  parts.push(...await Promise.all(jobs));
  return{result:dgLcMergeTileResults(parts),items:items.map(i=>i.id)};
}

async function dgLcAnalyze(params){
  if(!window.GeoTIFF)throw new Error("10 m COG okuyucu yüklenmedi.");
  const outer=params?.outer||[];
  const holes=params?.holes||[];
  const parkAreaM2=Number(params?.parkAreaM2||0);
  if(!outer.length)throw new Error("Analiz için park polygonu yok.");
  if(!(parkAreaM2>0))throw new Error("Park alanı geçersiz.");

  const bbox=dgLcBboxFromGeometry(outer,holes);
  const geom={outer,holes};

  /* BİRİNCİL ve çapraz kaynak bağımsız ağ istekleri: aynı anda başlatılır.
   * Birincil kaynak QA'dan geçmeden sonuç yayınlanmaz; çapraz kaynak yalnız
   * bağımsız uzlaşma göstergesi üretir. */
  const primPromise=dgLcAnalyzeSource(DG_LC_SOURCES.primary,bbox,geom);
  const crossPromise=dgLcAnalyzeSource(DG_LC_SOURCES.cross,bbox,geom)
    .catch(err=>{
      const msg=String(err&&err.message||err);
      console.warn("DENDROGEO · çapraz doğrulama kaynağı atlandı:",msg);
      return null;
    });

  const prim=await primPromise;
  const result=prim.result;
  if(!(result.assignedAreaM2>0))throw new Error("Park polygonu ile 10 m raster hücreleri kesişmiyor.");
  const deltaPct=Math.abs(result.assignedAreaM2-parkAreaM2)/parkAreaM2*100;
  if(deltaPct>0.5)throw new Error(
    "Raster/park alanı QA başarısız: "+deltaPct.toFixed(2)+"% fark. "+
    "Kısmi alan zorla yeniden dağıtılmadı."
  );

  /* ÇAPRAZ kaynak: IO LULC. Bu bağımsız kontrol birincil analizle aynı
   * anda yürütülür; böylece iki raster kaynağının toplam ağ gecikmesi
   * kullanıcıya seri şekilde yansımaz. Çapraz kaynak başarısız olursa
   * birincil gerçek sonuç korunur. */
  const cross=await crossPromise;
  const crossErr=cross?null:"Çapraz kaynak alınamadı.";

  /* YAPAY SU RAFİNASYONU:
   * ESA WorldCover 10 m rasterı küçük/yapay havuzları bazen yeşil veya
   * yapılı sınıfa atayabilir. OSM'deki açıkça water/pool/basin olarak
   * etiketlenmiş su geometrileri bağımsız vektör kanıtı olarak kullanılır.
   * Yalnızca hücre merkezi su geometrisinin içindeyse sınıf SU'ya çevrilir.
   * Rasterın ham kodu/rawCounts değiştirilmez; raporda rafine hücre sayısı
   * ayrıca belirtilir. OSM verisi yoksa veya alınamazsa raster sonucu aynen
   * korunur. */

  let waterRefined=0;
  try{
    const waterRings=await dgLcFetchWaterPolygons(bbox);
    waterRefined=dgLcRefineWater(result,waterRings);
    if(waterRefined>0){
      console.info("DENDROGEO · OSM su rafinasyonu:",waterRefined,"10 m hücre SU olarak işaretlendi.");
    }
  }catch(err){
    console.warn("DENDROGEO · OSM su rafinasyonu atlandı:",String(err&&err.message||err));
  }

  /* ASFALT/SERT YOL RAFİNASYONU:
   * Raster 10 m sınıfı dar asfalt yolları çevredeki yeşil/çıplak sınıfla
   * karıştırabilir. OSM'deki gerçek highway geometrisi hücreyle kesişiyorsa
   * hücre sert olarak işaretlenir. Sabit alan katsayısı uygulanmaz. */
  let roadRefined=0;
  try{
    const roadFeatures=await dgLcFetchRoadFeatures(bbox);
    roadRefined=dgLcRefineHardByOsm(result,roadFeatures,result.epsg);
    if(roadRefined>0){
      console.info("DENDROGEO · OSM yol rafinasyonu:",roadRefined,"10 m hücre SERT olarak işaretlendi.");
    }
  }catch(err){
    console.warn("DENDROGEO · OSM yol rafinasyonu atlandı:",String(err&&err.message||err));
  }

  const patches=dgLcDetectPatches(result.cells);
  const agreement=cross?dgLcGroupAgreement(result,cross.result):null;

  const report={
    year:DG_LC_SOURCES.primary.year,
    crossYear:DG_LC_SOURCES.cross.year,
    resolutionM:DG_LC_PIXEL_M,
    primaryLabel:DG_LC_SOURCES.primary.label,
    crossLabel:DG_LC_SOURCES.cross.label,
    primaryCitation:DG_LC_SOURCES.primary.citation,
    crossCitation:DG_LC_SOURCES.cross.citation,
    parkAreaM2,
    rasterCoverageAreaM2:result.assignedAreaM2,
    classifiedAreaM2:result.classifiedAreaM2,
    maskedAreaM2:result.maskedAreaM2,
    sourceCells:result.sourceCells,
    groupCounts:result.groupCounts,
    groupAreasM2:result.groupAreas,
    rawCounts:result.rawCounts,
    rawAreasM2:result.rawAreas,
    patches:patches.map(pt=>({
      group:pt.classKey,
      areaHa:+(pt.areaM2/10000).toFixed(3),
      cells:pt.cells,
      centroidLat:+pt.centroid.lat.toFixed(6),
      centroidLon:+pt.centroid.lon.toFixed(6)
    })),
    agreement,
    waterRefinedCells:waterRefined,
    roadRefinedCells:roadRefined,
    crossError:crossErr,
    primaryItems:prim.items,
    crossItems:cross?cross.items:null,
    areaDeltaPct:deltaPct,
    classes:Object.fromEntries(DG_LC_CLASSES.map(cls=>{
      const area=result.groupAreas?.[cls.key]||0;
      const count=result.groupCounts?.[cls.key]||0;
      return[cls.key,{
        label:cls.label,
        emoji:cls.emoji,
        color:cls.color,
        count,
        areaM2:area,
        areaHa:+(area/10000).toFixed(3),
        pct:result.assignedAreaM2>0?+(area/result.assignedAreaM2*100).toFixed(2):0
      }];
    }))
  };

  DG_LC_LAST={report,result,crossResult:cross?cross.result:null,patches};
  dgLcRenderObjects(patches);
  return report;
}

function downloadLandCoverClassCSV(){
  if(!DG_LC_LAST)return toast("Önce arazi örtüsü analizini çalıştırın.","warn","🗺️");
  downloadBlob(
    "dendrogeo_landcover_"+(DG_LC_LAST.report?.year||2021)+"_classes.csv",
    "text/csv;charset=utf-8",
    dgLcClassCsv(DG_LC_LAST.result,{
      year:DG_LC_LAST.report?.year,
      resolutionM:DG_LC_PIXEL_M,
      primaryLabel:DG_LC_LAST.report?.primaryLabel
    })
  );
  toast("✓ Sınıf arazi örtüsü CSV'si indirildi.","ok","📥");
}

function downloadLandCoverCellsGeoJSON(){
  if(!DG_LC_LAST)return toast("Önce arazi örtüsü analizini çalıştırın.","warn","🗺️");
  downloadBlob(
    "dendrogeo_landcover_"+(DG_LC_LAST.report?.year||2021)+"_10m_cells.geojson",
    "application/geo+json;charset=utf-8",
    JSON.stringify(dgLcCellsGeoJson(DG_LC_LAST.result),null,2)
  );
  toast("✓ 10 m hücre GeoJSON'u indirildi.","ok","📍");
}

function clearLandCover(){
  DG_LC_LAST=null;
  dgLcClearLayer();
}

window.DG_LANDCOVER_RENDER_REPORT=dgLcRenderReport;
window.DG_LANDCOVER={
  analyze:dgLcAnalyze,
  clear:clearLandCover,
  getLast:()=>DG_LC_LAST,
  isGreen:dgLcIsGreen,
  hasGreen:dgLcHasGreen,
  downloadClassCSV:downloadLandCoverClassCSV,
  downloadCellsGeoJSON:downloadLandCoverCellsGeoJSON
};
window.downloadLandCoverClassCSV=downloadLandCoverClassCSV;
window.downloadLandCoverCellsGeoJSON=downloadLandCoverCellsGeoJSON;
