"use strict";
/* DendroGeo · services/lc-osm.js — OSM rafinasyon katmanı (Faz 5)
 * landcover.js'ten birebir taşındı: yapay havuz/su rafinasyonu
 * (dgLcFetchWaterPolygons + dgLcRefineWater) ve OSM yol geometrisiyle
 * sert-zemin rafinasyonu (surface sınıfları, yarı genişlikler, hücre
 * teması). Overpass aynaları simple-request POST kullanır (CORS-safe). */

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

  /* KRİTİK QA KURALI:
   * Bu rafinasyon "her highway = sert zemin" demek değildir.
   * Park içindeki service/track/footway vb. yolların büyük bölümü
   * asfalt olmak zorunda değildir. Sert sınıfa yalnız OSM'nin yüzey
   * etiketi gerçekten sert bir malzeme gösteriyorsa girer.
   * Böylece yolun etrafındaki yeşil/çıplak pikseller topluca sertleşmez. */
  if(!dgLcRoadSurfaceIsHard(t.surface))return false;

  /* highway etiketi yalnızca gerçek yol tipini kaydetmek için kullanılır.
   * Yüzey kanıtı yoksa yukarıdaki koşul nedeniyle sonuç sertleşmez. */
  /* Land-cover sert zemin düzeltmesi yalnızca araç yolu karakterindeki
   * highway tiplerini kullanır. Park içindeki yaya/bisiklet yolları asfalt
   * etiketli olsa bile 10 m hücreyi otomatik olarak "Sert" yapmaz; aksi halde
   * dar bir yürüyüş yolu çevresindeki yeşil pikseli yol gibi boyayabilir.
   * Yaya yolları grid/erişim analizinde ayrıca ele alınabilir. */
  return [
    "motorway","trunk","primary","secondary","tertiary",
    "unclassified","residential","living_street","service"
  ].includes(hw);
}

async function dgLcFetchRoadFeatures(bbox){
  const b=[bbox.minLat,bbox.minLon,bbox.maxLat,bbox.maxLon].join(",");
  const q=
    "[out:json][timeout:60];("+
    "way[\"highway\"]("+b+");"+
    "way[\"area:highway\"]("+b+");"+
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

  /* area:highway gerçek bir yüzey poligonuysa hücre ile gerçek
   * geometrik kesişimi kabul et. */
  if(feature.area){
    const inside=(p,poly)=>{
      let hit=false;
      for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const a=poly[i],b=poly[j];
        if(((a.y>p.y)!==(b.y>p.y))&&
          p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
      }
      return hit;
    };
    if(road.some(p=>inside(p,quad)))return true;
    if(quad.some(p=>inside(p,road)))return true;
    return false;
  }

  /* Çizgisel yol için KORUYUCU kural:
   * 10 m hücrenin tamamını sert yapmak ancak hücrenin merkezi gerçek
   * yol genişliğinin içinde kalıyorsa mümkündür.
   *
   * Önceki iki sürümde:
   *   - yarı köşegen eklendi,
   *   - ardından hücreyi kesen ince bir yol bile tüm hücreyi sert yaptı.
   * Bu, Göksu'daki yol kenarı yeşil alanlarını sertleştirebiliyordu.
   *
   * Şimdi komşu hücreler yalnızca yol genişliğinin gerçekten içinde
   * kalıyorsa rafine edilir. Yol hücre merkezinden geçmiyorsa WorldCover
   * sınıfı korunur. Böylece OSM yolu raster sınıfını ezmek için çok daha
   * güçlü bir geometrik kanıt ister. */
  const hw=Math.max(0,Number(feature.halfWidth)||0);
  if(!(hw>0))return false;

  for(let i=0;i<road.length-1;i++){
    if(dgLcPointSegmentDistanceXY(center,road[i],road[i+1])<=hw){
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
