"use strict";
/* DendroGeo · services/lc-engine.js — LULC sınıflandırma motoru (Faz 5)
 * landcover.js'ten birebir taşındı: kod→sınıf haritaları, COG okuma +
 * hücre kesişimi (dgLcProcessTile), karo sonuçlarının birleştirilmesi,
 * kaynak uzlaşma yüzdesi, tek kaynak analizi (dgLcAnalyzeSource) ve
 * CSV/GeoJSON serileştiriciler. GeoTIFF global'ini çağrı anında kullanır. */

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
