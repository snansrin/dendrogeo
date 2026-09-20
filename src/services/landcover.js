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

const DG_LC_CLASSES=[
  {key:"green",label:"Yeşil alan",emoji:"🌿",codes:[2,4,5,11],color:"#2e8b57"},
  {key:"water",label:"Su",emoji:"💧",codes:[1],color:"#2563eb"},
  {key:"hard",label:"Sert zemin",emoji:"🧱",codes:[7],color:"#c4281b"},
  {key:"bare",label:"Çıplak zemin",emoji:"🟫",codes:[8],color:"#a59b8f"},
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

function dgLcUtmEpsgFromItem(item,geoKeys){
  const p=item?.properties||{};
  const candidates=[
    p["proj:epsg"],
    p["proj:code"],
    geoKeys?.ProjectedCSTypeGeoKey
  ];
  for(const v of candidates){
    const n=Math.round(Number(v));
    if((n>=32601&&n<=32660)||(n>=32701&&n<=32760))return n;
  }
  return null;
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

function dgLcIntersectionArea(outerRings,holeRings,rect){
  let area=0;
  for(const ring of (outerRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,rect))continue;
    const clipped=dgLcClipPolygonRect(ring,rect);
    area+=dgLcPlanarArea(clipped);
  }
  for(const ring of (holeRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,rect))continue;
    const clipped=dgLcClipPolygonRect(ring,rect);
    area-=dgLcPlanarArea(clipped);
  }
  return Math.max(0,area);
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
            dgLcRunPush(runs,globalRow,runStart,globalCol,runCls,meta,analysisEpsg);
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
          if(runStart>=0)dgLcRunPush(runs,globalRow,runStart,globalCol,runCls,meta,analysisEpsg);
          runStart=globalCol;runCls=classKey;
        }

        if(cells.length<10000){
          const cx=(quad[0].x+quad[1].x+quad[2].x+quad[3].x)/4;
          const cy=(quad[0].y+quad[1].y+quad[2].y+quad[3].y)/4;
          const inv=p=>isUtm?dgLcUtmInverse(p.x,p.y,analysisEpsg):{lat:(meta.maxY-globalRow*meta.dy)-meta.dy/2,lon:(meta.minX+globalCol*meta.dx)+meta.dx/2};
          const c0=inv(quad[0]),c1=inv(quad[1]),c2=inv(quad[2]),c3=inv(quad[3]);
          const center=isUtm?inv({x:cx,y:cy}):{lat:(meta.maxY-globalRow*meta.dy)-meta.dy/2,lon:(meta.minX+globalCol*meta.dx)+meta.dx/2};
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

function dgLcRenderRuns(runs){
  if(DG_LC_LAYER&&typeof map!=="undefined"&&map){
    map.removeLayer(DG_LC_LAYER);
    DG_LC_LAYER=null;
  }
  if(typeof map==="undefined"||!map||!window.L)return;
  if(!runs.length)return;
  if(runs.length>DG_LC_RENDER_LIMIT){
    console.warn("DENDROGEO · 10 m görselleştirme atlandı: "+runs.length+" ardışık hücre bandı.");
    return;
  }
  /* Binlerce bant SVG ile ağır olur; canvas renderer belirgin hızlandırır. */
  const renderer=(typeof L.canvas==="function")?L.canvas({padding:.2}):null;
  DG_LC_LAYER=L.layerGroup().addTo(map);
  for(const r of runs){
    if(!r.classKey)continue;
    /* EPSG:4326 karolarında run koordinatları zaten derecedir. */
    const p1=r.epsg===4326?{lat:r.y0,lon:r.x0}:dgLcUtmInverse(r.x0,r.y0,r.epsg);
    const p2=r.epsg===4326?{lat:r.y0,lon:r.x1}:dgLcUtmInverse(r.x1,r.y0,r.epsg);
    const p3=r.epsg===4326?{lat:r.y1,lon:r.x1}:dgLcUtmInverse(r.x1,r.y1,r.epsg);
    const p4=r.epsg===4326?{lat:r.y1,lon:r.x0}:dgLcUtmInverse(r.x0,r.y1,r.epsg);
    const cls=DG_LC_CLASSES.find(c=>c.key===r.classKey);
    if(!cls)continue;
    L.polygon(
      [[p1.lat,p1.lon],[p2.lat,p2.lon],[p3.lat,p3.lon],[p4.lat,p4.lon]],
      {
        color:cls.color,
        weight:.8,
        opacity:.55,
        fillColor:cls.color,
        fillOpacity:.48,
        interactive:false,
        renderer:renderer||undefined
      }
    ).addTo(DG_LC_LAYER);
  }
}

function dgLcClearLayer(){
  if(DG_LC_LAYER&&typeof map!=="undefined"&&map){
    map.removeLayer(DG_LC_LAYER);
  }
  DG_LC_LAYER=null;
}

function dgLcRenderReport(rep,result,parkAreaM2,extra){
  if(!rep)return;
  /* analyze() rapor nesnesi ile ham result nesnesi aynı raporlayıcıyı
   * kullanabilsin diye alan adları normalize edilir. */
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
  /* Ekstra rapor alanları üç kaynaktan gelebilir (öncelik sırasıyla):
   *   1) extra parametresi (çağranın açıkça verdikleri)
   *   2) result'un KENDİSİ rapor biçimindeyse (report.agreement/patches/...)
   *   3) DG_LC_LAST (analyze'in bıraktığı son durum — gridplan böyle çağırır) */
  const last=(typeof DG_LC_LAST!=="undefined"&&DG_LC_LAST&&DG_LC_LAST.report)?DG_LC_LAST.report:null;
  const exSrc=extra||(result.agreement||result.patches?result:last)||{};
  const ex={
    primaryYear:exSrc.primaryYear!=null?exSrc.primaryYear:exSrc.year,
    primaryLabel:exSrc.primaryLabel,
    primaryCitation:exSrc.primaryCitation,
    crossCitation:exSrc.crossCitation,
    crossLabel:exSrc.crossLabel,
    agreement:exSrc.agreement,
    crossError:exSrc.crossError,
    patches:exSrc.patches
  };
  const analysisArea=R.assignedAreaM2;
  const GROUP_ORDER=["green","water","hard","bare","other"];
  const rows=GROUP_ORDER.map(k=>{
    const cls=DG_LC_CLASSES.find(c=>c.key===k);
    const count=R.groupCounts?.[k]||0;
    const area=R.groupAreas?.[k]||0;
    if(!count&&!area)return"";
    const pct=analysisArea>0?area/analysisArea*100:0;
    return"<tr>"+
      "<td>"+cls.emoji+"</td>"+
      "<td><b>"+cls.label+"</b></td>"+
      "<td class='mono'>"+count.toLocaleString("tr-TR")+"</td>"+
      "<td class='mono'>"+(area/10000).toFixed(2)+"</td>"+
      "<td class='mono'>%"+pct.toFixed(1)+"</td>"+
      "</tr>";
  }).join("");

  /* Çapraz kaynak uzlaşma tablosu */
  let crossHtml="";
  if(ex.agreement){
    const crows=GROUP_ORDER.map(k=>{
      const a=ex.agreement[k];
      if(!a||(!a.primaryHa&&!a.crossHa))return"";
      const cls=DG_LC_CLASSES.find(c=>c.key===k);
      const renk=a.agreementPct>=80?"var(--green-dk)":a.agreementPct>=60?"#92400e":"#991b1b";
      return"<tr><td>"+cls.emoji+" "+cls.label+"</td>"+
        "<td class='mono'>"+a.primaryHa.toFixed(2)+"</td>"+
        "<td class='mono'>"+a.crossHa.toFixed(2)+"</td>"+
        "<td class='mono' style='color:"+renk+"'>%"+a.agreementPct.toFixed(0)+"</td></tr>";
    }).join("");
    if(crows){
      crossHtml="<div style='margin-top:10px'><b style='font-size:.72rem'>🔬 Çapraz doğrulama</b>"+
        "<div style='font-size:.67rem;color:var(--mut);margin:4px 0 6px'>Bağımsız ikinci kaynak ("+
        (ex.crossLabel||"")+") aynı polygon için:</div>"+
        "<table><thead><tr><th>Grup</th><th>Ana (ha)</th><th>Çapraz (ha)</th><th>Uzlaşma</th></tr></thead><tbody>"+
        crows+"</tbody></table></div>";
    }
  }else if(ex.crossError){
    crossHtml="<div style='font-size:.67rem;color:var(--mut);margin-top:8px'>🔬 Çapraz doğrulama yapılamadı: "+
      String(ex.crossError).slice(0,120)+"</div>";
  }

  /* Nesne tanıma: bağlı bileşenler */
  let patchHtml="";
  if(ex.patches&&ex.patches.length){
    const byKey={};
    /* patch nesneleri iki biçimde gelebilir: ham {classKey,areaM2} veya
     * rapor biçimi {group,areaHa}. İkisi de desteklenir. */
    for(const pt of ex.patches){
      const k=pt.classKey||pt.group;
      (byKey[k]=byKey[k]||[]).push(pt);
    }
    patchHtml="<div style='margin-top:10px'><b style='font-size:.72rem'>🧩 Nesne tanımlama</b>"+
      "<div style='font-size:.67rem;color:var(--mut);margin:4px 0 6px'>Bağlantılı 10 m hücre bileşenleri (≥0,05 ha):</div>";
    for(const k of GROUP_ORDER){
      const list=byKey[k];
      if(!list||!list.length)continue;
      const cls=DG_LC_CLASSES.find(c=>c.key===k);
      patchHtml+="<div style='font-size:.68rem;margin:3px 0'>"+cls.emoji+" <b>"+cls.label+":</b> "+
        list.length+" nesne · "+
        list.slice(0,4).map(pt=>((pt.areaHa!=null?pt.areaHa:(pt.areaM2||0)/10000)).toFixed(2)+" ha").join(", ")+
        (list.length>4?" …":"")+"</div>";
    }
    patchHtml+="</div>";
  }

  const classifiedPct=analysisArea>0?R.classifiedAreaM2/analysisArea*100:0;
  const maskedPct=analysisArea>0?R.maskedAreaM2/analysisArea*100:0;
  const areaDeltaPct=parkAreaM2>0?Math.abs(analysisArea-parkAreaM2)/parkAreaM2*100:0;
  const closureNote=areaDeltaPct>0.5
    ?"<div style='margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(220,38,38,.08);color:#991b1b;font-size:.68rem'>⚠ Raster/park alanı farkı %"+areaDeltaPct.toFixed(2)+"; sonuç geometrik kalite kontrolünden geçmedi.</div>"
    :"";
  const maskNote=R.maskedAreaM2>0
    ?"<div style='margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.10);color:#92400e;font-size:.68rem'>⚠ Veri dışı/maskeli alan: <b>"+(R.maskedAreaM2/10000).toFixed(2)+" ha</b> (%"+maskedPct.toFixed(1)+"). Bu alan sınıflara dağıtılmadı.</div>"
    :"";
  const sourceDiff=areaDeltaPct<=0.5
    ?"<span style='color:var(--green-dk)'>✓ Raster/park alanı geometrik QA geçti</span>"
    :"";

  rep.innerHTML=
    "<b>🗺️ Arazi Örtüsü · 10 m · "+(ex.primaryYear||2021)+"</b>"+
    "<div style='font-size:.70rem;color:var(--mut);margin:7px 0 10px'>"+
      "<b>Ana kaynak:</b> "+(ex.primaryLabel||"")+". Seçili park polygonu ile 10 m raster hücrelerinin "+
      "GERÇEK kesişim alanı hesaplanır (hücre sayımı değil, tam poligon kesişimi). "+
      "EPSG:4326 karolarda hücre köşeleri analiz UTM'sine projekte edilir.</div>"+
    "<div style='overflow:auto'><table><thead><tr><th></th><th>Sınıf</th><th>10 m hücre</th><th>Alan (ha)</th><th>%</th></tr></thead><tbody>"+
      rows+
    "</tbody></table></div>"+
    crossHtml+
    patchHtml+
    "<div style='font-size:.69rem;color:var(--mut);margin-top:10px'>"+
      "<b>Park polygonu:</b> "+(parkAreaM2/10000).toFixed(2)+" ha · "+
      "<b>Analiz alanı:</b> "+(analysisArea/10000).toFixed(2)+" ha · "+
      "<b>Kaynak hücre:</b> "+R.sourceCells.toLocaleString("tr-TR")+
      (sourceDiff?" · "+sourceDiff:"")+
    "</div>"+
    maskNote+
    closureNote+
    "<div style='font-size:.67rem;color:var(--mut);margin-top:7px'>"+
      "<b>Sınıflandırma kapsamı:</b> %"+classifiedPct.toFixed(1)+" · "+
      "Kaynaklar: "+(ex.primaryCitation||"")+(ex.crossCitation?" + "+ex.crossCitation:"")+".</div>"+
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
    patches.push({
      classKey:comp[0].classKey,
      areaM2:area,
      cells:comp.length,
      centroid:{lat:wl/area,lon:wo/area}
    });
  }
  patches.sort((a,b)=>b.areaM2-a.areaM2);
  return patches;
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
  const items=await dgLcFindTiles(bbox,src);
  if(items.length>DG_LC_MAX_TILES)throw new Error("AOI çok sayıda 10 m veri karosuna taşıyor; analiz güvenliği nedeniyle durduruldu.");
  const token=await dgLcGetSas(src.collection);
  const parts=[];
  const seen=new Set();
  for(const item of items){
    if(seen.has(item.id))continue;
    seen.add(item.id);
    const asset=dgLcGetDataAsset(item,src);
    if(!asset?.href)throw new Error(src.year+" veri karosunun COG asset'i bulunamadı: "+item.id);
    const href=dgLcSignedHref(asset.href,token);
    parts.push(await dgLcProcessTile(item,href,geom,src));
  }
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

  /* BİRİNCİL kaynak: ESA WorldCover */
  const prim=await dgLcAnalyzeSource(DG_LC_SOURCES.primary,bbox,geom);
  const result=prim.result;
  if(!(result.assignedAreaM2>0))throw new Error("Park polygonu ile 10 m raster hücreleri kesişmiyor.");
  const deltaPct=Math.abs(result.assignedAreaM2-parkAreaM2)/parkAreaM2*100;
  if(deltaPct>0.5)throw new Error(
    "Raster/park alanı QA başarısız: "+deltaPct.toFixed(2)+"% fark. "+
    "Kısmi alan zorla yeniden dağıtılmadı."
  );

  /* ÇAPRAZ kaynak: io-lulc (best-effort; başarısızlığı analizi bozmaz) */
  let cross=null,crossErr=null;
  try{
    cross=await dgLcAnalyzeSource(DG_LC_SOURCES.cross,bbox,geom);
  }catch(err){
    crossErr=String(err&&err.message||err);
    console.warn("DENDROGEO · çapraz doğrulama kaynağı atlandı:",crossErr);
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
  dgLcRenderRuns(result.runs);
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
  downloadClassCSV:downloadLandCoverClassCSV,
  downloadCellsGeoJSON:downloadLandCoverCellsGeoJSON
};
window.downloadLandCoverClassCSV=downloadLandCoverClassCSV;
window.downloadLandCoverCellsGeoJSON=downloadLandCoverCellsGeoJSON;
