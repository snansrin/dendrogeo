"use strict";
/* DendroGeo · 10 m Land Cover Engine v1
 * Native UTM COG + STAC + polygon/cell coverage analysis.
 *
 * The application does NOT query a live imagery service for classification.
 * It reads the published annual categorical land-cover COG that matches the
 * native 10 m UTM tiling grid, then computes each raster-cell intersection
 * with the selected park polygon.
 */

const DG_LC_COLLECTION="io-lulc-annual-v02";
const DG_LC_YEAR=2020;
const DG_LC_STAC="https://planetarycomputer.microsoft.com/api/stac/v1";
const DG_LC_SAS="https://planetarycomputer.microsoft.com/api/sas/v1/token/"+DG_LC_COLLECTION;
const DG_LC_PIXEL_M=10;
const DG_LC_MAX_TILES=12;
const DG_LC_MAX_READ_PIXELS=2500000;
const DG_LC_RENDER_LIMIT=2500;

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
  {key:"bare",label:"Çıplak zemin",emoji:"🟫",codes:[8],color:"#a59b8f"}
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

async function dgLcFindTiles(bbox){
  const payload={
    collections:[DG_LC_COLLECTION],
    bbox:[bbox.minLon,bbox.minLat,bbox.maxLon,bbox.maxLat],
    datetime:DG_LC_YEAR+"-01-01T00:00:00Z/"+DG_LC_YEAR+"-12-31T23:59:59Z",
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
  const items=Array.isArray(data?.features)?data.features:[];
  if(!items.length)throw new Error("2020 yıllık 10 m arazi örtüsü için parkla kesişen veri karosu bulunamadı.");
  return items;
}

async function dgLcGetSas(){
  try{
    const data=await dgLcFetchJson(DG_LC_SAS,{headers:{Accept:"application/json"}});
    return data?.token||"";
  }catch(err){
    console.warn("DENDROGEO · Veri imzalama tokenı alınamadı; doğrudan açık asset deneniyor.",err);
    return"";
  }
}

function dgLcGetDataAsset(item){
  const a=item?.assets||{};
  return a.data||a.lulc||Object.values(a).find(v=>
    v&&String(v.type||"").toLowerCase().includes("geotiff")
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

function dgLcProcessTile(item,href,geometryWgs){
  return GeoTIFF.fromUrl(href).then(async tiff=>{
    const image=await tiff.getImage();
    const keys=typeof image.getGeoKeys==="function"?image.getGeoKeys():null;
    const epsg=dgLcUtmEpsgFromItem(item,keys)||dgLcUtmEpsgForLatLon(
      (geometryWgs.outer[0]?.[0]?.[0]??40),
      (geometryWgs.outer[0]?.[0]?.[1]??32)
    );
    const geometry=dgLcProjectGeometry(geometryWgs.outer,geometryWgs.holes,epsg);
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
    const win=dgLcWindowForPark(meta,parkBBox);
    const px=(win[2]-win[0])*(win[3]-win[1]);
    if(px>DG_LC_MAX_READ_PIXELS){
      throw new Error("Park alanı tek karoda çok büyük; güvenli 10 m COG okuma sınırını aşıyor.");
    }

    const values=await image.readRasters({
      window:win,
      samples:[0],
      interleave:true
    });

    const counts={};
    const areas={};
    for(const code of [0,1,2,4,5,7,8,9,10,11])counts[code]=0,areas[code]=0;
    const runs=[];
    const cells=[];
    let assignedAreaM2=0;
    let classifiedAreaM2=0;
    let maskedAreaM2=0;
    let maskedCount=0;
    let sourceCells=0;

    const rowStart=win[1],colStart=win[0],localW=win[2]-win[0];

    for(let rr=0;rr<(win[3]-win[1]);rr++){
      let runStart=-1,runCls=null;
      for(let cc=0;cc<localW;cc++){
        const globalRow=rowStart+rr;
        const globalCol=colStart+cc;
        const yTop=meta.maxY-globalRow*meta.dy;
        const yBottom=yTop-meta.dy;
        const x0=meta.minX+globalCol*meta.dx;
        const x1=x0+meta.dx;
        const rect={minX:x0,minY:yBottom,maxX:x1,maxY:yTop};

        if(!dgLcBboxOverlap(rect,parkBBox))continue;
        const area=dgLcIntersectionArea(geometry.outer,geometry.holes,rect);
        if(!(area>1e-8))continue;

        sourceCells++;
        assignedAreaM2+=area;

        const raw=Number(values[rr*localW+cc]);
        const code=dgLcCodeToClass(raw);
        const classKey=dgLcReportClassForCode(code);

        if(code===9||code===10||code===0||code===null){
          maskedAreaM2+=area;
          maskedCount++;
          if(runStart>=0){
            dgLcRunPush(runs,globalRow,runStart,globalCol,runCls,meta,epsg);
            runStart=-1;runCls=null;
          }
        }else{
          counts[code]=(counts[code]||0)+1;
          areas[code]=(areas[code]||0)+area;
          classifiedAreaM2+=area;
          if(classKey!==runCls){
            if(runStart>=0){
              dgLcRunPush(runs,globalRow,runStart,globalCol,runCls,meta,epsg);
            }
            runStart=globalCol;
            runCls=classKey;
          }

          if(cells.length<10000){
            cells.push({
              row:globalRow,
              col:globalCol,
              classCode:code,
              className:DG_LC_CODES[code]||"Bilinmeyen",
              classKey,
              areaM2:area,
              center:{
                x:(x0+x1)/2,
                y:(yBottom+yTop)/2
              },
              epsg
            });
          }
        }
      }
      if(runStart>=0){
        dgLcRunPush(runs,globalRow,runStart,win[2],runCls,meta,epsg);
      }
    }

    return{
      itemId:item.id,
      epsg,
      parkAreaNative,
      assignedAreaM2,
      classifiedAreaM2,
      maskedAreaM2,
      maskedCount,
      sourceCells,
      counts,
      areas,
      runs,
      cells,
      rasterMeta:meta,
      window:win
    };
  });
}

function dgLcMergeTileResults(parts){
  const outCounts={};
  const outAreas={};
  const runs=[];
  const cells=[];
  let assigned=0,classified=0,masked=0,maskedCount=0,sourceCells=0;
  for(const p of parts){
    assigned+=p.assignedAreaM2;
    classified+=p.classifiedAreaM2;
    masked+=p.maskedAreaM2;
    maskedCount+=p.maskedCount;
    sourceCells+=p.sourceCells;
    for(const [k,v] of Object.entries(p.counts))outCounts[k]=(outCounts[k]||0)+v;
    for(const [k,v] of Object.entries(p.areas))outAreas[k]=(outAreas[k]||0)+v;
    runs.push(...p.runs);
    if(cells.length<10000)cells.push(...p.cells);
  }
  return{
    assignedAreaM2:assigned,
    classifiedAreaM2:classified,
    maskedAreaM2:masked,
    maskedCount,
    sourceCells,
    counts:outCounts,
    areas:outAreas,
    runs,
    cells,
    tiles:parts.map(p=>({id:p.itemId,epsg:p.epsg,assignedAreaM2:p.assignedAreaM2}))
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
  DG_LC_LAYER=L.layerGroup().addTo(map);
  for(const r of runs){
    if(!r.classKey)continue;
    const p1=dgLcUtmInverse(r.x0,r.y0,r.epsg);
    const p2=dgLcUtmInverse(r.x1,r.y0,r.epsg);
    const p3=dgLcUtmInverse(r.x1,r.y1,r.epsg);
    const p4=dgLcUtmInverse(r.x0,r.y1,r.epsg);
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
        interactive:false
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

function dgLcRenderReport(rep,result,parkAreaM2){
  if(!rep)return;
  const analysisArea=result.assignedAreaM2;
  const rows=DG_LC_CLASSES.map(cls=>{
    const count=cls.codes.reduce((s,c)=>s+(result.counts[c]||0),0);
    const area=cls.codes.reduce((s,c)=>s+(result.areas[c]||0),0);
    const pct=analysisArea>0?area/analysisArea*100:0;
    return"<tr>"+
      "<td>"+cls.emoji+"</td>"+
      "<td><b>"+cls.label+"</b></td>"+
      "<td class='mono'>"+count.toLocaleString("tr-TR")+"</td>"+
      "<td class='mono'>"+(area/10000).toFixed(2)+"</td>"+
      "<td class='mono'>%"+pct.toFixed(1)+"</td>"+
      "</tr>";
  }).join("");

  const classifiedPct=analysisArea>0?result.classifiedAreaM2/analysisArea*100:0;
  const maskedPct=analysisArea>0?result.maskedAreaM2/analysisArea*100:0;
  const areaDeltaPct=parkAreaM2>0?Math.abs(analysisArea-parkAreaM2)/parkAreaM2*100:0;
  const closureNote=areaDeltaPct>0.5
    ?"<div style='margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(220,38,38,.08);color:#991b1b;font-size:.68rem'>⚠ Raster/park alanı farkı %"+areaDeltaPct.toFixed(2)+"; sonuç geometrik kalite kontrolünden geçmedi.</div>"
    :"";
  const maskNote=result.maskedAreaM2>0
    ?"<div style='margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.10);color:#92400e;font-size:.68rem'>⚠ Veri dışı/maskeli alan: <b>"+(result.maskedAreaM2/10000).toFixed(2)+" ha</b> (%"+maskedPct.toFixed(1)+"). Bu alan dört sınıfa dağıtılmadı.</div>"
    :"";
  const sourceDiff=areaDeltaPct<=0.5
    ?"<span style='color:var(--green-dk)'>✓ Raster/park alanı geometrik QA geçti</span>"
    :"";

  rep.innerHTML=
    "<b>🗺️ Arazi Örtüsü · 10 m · 2020</b>"+
    "<div style='font-size:.70rem;color:var(--mut);margin:7px 0 10px'>"+
      "<b>Ana yöntem:</b> seçili park polygonu ile yerel 10 m UTM raster hücrelerinin gerçek kesişim alanı hesaplanır. "+
      "Hücre sayısı alan tahminine çevrilmez; her hücrenin polygon içinde kalan yüzölçümü doğrudan toplanır.</div>"+
    "<div style='overflow:auto'><table><thead><tr><th></th><th>Sınıf</th><th>10 m hücre</th><th>Alan (ha)</th><th>%</th></tr></thead><tbody>"+
      rows+
    "</tbody></table></div>"+
    "<div style='font-size:.69rem;color:var(--mut);margin-top:10px'>"+
      "<b>Park polygonu:</b> "+(parkAreaM2/10000).toFixed(2)+" ha · "+
      "<b>Analiz alanı:</b> "+(analysisArea/10000).toFixed(2)+" ha · "+
      "<b>Kaynak hücre:</b> "+result.sourceCells.toLocaleString("tr-TR")+
      (sourceDiff?" · "+sourceDiff:"")+
    "</div>"+
    "<div style='font-size:.68rem;color:var(--mut);margin-top:7px'>"+
      "Yeşil alan = ağaç + taşkın vejetasyon + tarım + rangeland · Sert zemin = yapılı alan · "+
      "Su = su · Çıplak zemin = çıplak zemin.</div>"+
    maskNote+
    closureNote+
    "<div style='font-size:.67rem;color:var(--mut);margin-top:7px'>"+
      "<b>Geçerli sınıflandırma kapsamı:</b> %"+classifiedPct.toFixed(1)+" · "+
      "Kaynak: Impact Observatory · 10m Annual Land Use Land Cover V2 · CC BY 4.0.</div>"+
    "<div style='display:flex;gap:7px;flex-wrap:wrap;margin-top:10px'>"+
      "<button class='btn sm ghost' onclick='downloadLandCoverClassCSV()'>📥 4 sınıf CSV</button>"+
      "<button class='btn sm ghost' onclick='downloadLandCoverCellsGeoJSON()'>📍 10 m hücre GeoJSON</button>"+
    "</div>";
}

function dgLcClassCsv(result){
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const rows=[["CLASS","SOURCE_CELL_COUNT","AREA_HA","PERCENT_OF_RASTER_COVERAGE","YEAR","RESOLUTION_M"]];
  const denominator=result.assignedAreaM2;
  for(const cls of DG_LC_CLASSES){
    const count=cls.codes.reduce((s,c)=>s+(result.counts[c]||0),0);
    const area=cls.codes.reduce((s,c)=>s+(result.areas[c]||0),0);
    rows.push([
      q(cls.label),
      count,
      (area/10000).toFixed(4),
      denominator>0?(area/denominator*100).toFixed(4):"0",
      DG_LC_YEAR,
      DG_LC_PIXEL_M
    ]);
  }
  rows.push([
    q("MASKELİ / NODATA"),
    result.maskedCount,
    (result.maskedAreaM2/10000).toFixed(4),
    denominator>0?(result.maskedAreaM2/denominator*100).toFixed(4):"0",
    DG_LC_YEAR,
    DG_LC_PIXEL_M
  ]);
  return"\uFEFF"+rows.map(r=>r.join(",")).join("\n")+"\n";
}

function dgLcCellsGeoJson(result){
  const features=result.cells.map((c,i)=>{
    const s=dgLcUtmInverse(c.center.x,c.center.y,c.epsg);
    const half=DG_LC_PIXEL_M/2;
    const p1=dgLcUtmInverse(c.center.x-half,c.center.y-half,c.epsg);
    const p2=dgLcUtmInverse(c.center.x+half,c.center.y-half,c.epsg);
    const p3=dgLcUtmInverse(c.center.x+half,c.center.y+half,c.epsg);
    const p4=dgLcUtmInverse(c.center.x-half,c.center.y+half,c.epsg);
    return{
      type:"Feature",
      properties:{
        cell_id:i+1,
        row:c.row,
        column:c.col,
        class_code:c.classCode,
        class_name:c.className,
        group:c.classKey,
        intersection_area_m2:+Number(c.areaM2||0).toFixed(4),
        center_lat:+s.lat.toFixed(7),
        center_lon:+s.lon.toFixed(7),
        year:DG_LC_YEAR,
        resolution_m:DG_LC_PIXEL_M,
        source:"Impact Observatory 10m Annual Land Use Land Cover V2"
      },
      geometry:{
        type:"Polygon",
        coordinates:[[
          [p1.lon,p1.lat],
          [p2.lon,p2.lat],
          [p3.lon,p3.lat],
          [p4.lon,p4.lat],
          [p1.lon,p1.lat]
        ]]
      }
    };
  });
  return{
    type:"FeatureCollection",
    name:"dendrogeo_10m_landcover_2020",
    features
  };
}

async function dgLcAnalyze(params){
  if(!window.GeoTIFF)throw new Error("10 m COG okuyucu yüklenmedi.");
  const outer=params?.outer||[];
  const holes=params?.holes||[];
  const parkAreaM2=Number(params?.parkAreaM2||0);
  if(!outer.length)throw new Error("Analiz için park polygonu yok.");
  if(!(parkAreaM2>0))throw new Error("Park alanı geçersiz.");

  const bbox=dgLcBboxFromGeometry(outer,holes);
  const items=await dgLcFindTiles(bbox);
  if(items.length>DG_LC_MAX_TILES)throw new Error("AOI çok sayıda 10 m veri karosuna taşıyor; analiz güvenliği nedeniyle durduruldu.");

  const token=await dgLcGetSas();
  const parts=[];
  const seen=new Set();

  for(const item of items){
    if(seen.has(item.id))continue;
    seen.add(item.id);
    const asset=dgLcGetDataAsset(item);
    if(!asset?.href)throw new Error("2020 veri karosunun COG asset'i bulunamadı: "+item.id);
    const href=dgLcSignedHref(asset.href,token);
    const part=await dgLcProcessTile(item,href,{outer,holes});
    parts.push(part);
  }

  const result=dgLcMergeTileResults(parts);
  if(!(result.assignedAreaM2>0))throw new Error("Park polygonu ile 10 m raster hücreleri kesişmiyor.");
  const deltaPct=Math.abs(result.assignedAreaM2-parkAreaM2)/parkAreaM2*100;
  if(deltaPct>0.5)throw new Error(
    "Raster/park alanı QA başarısız: "+deltaPct.toFixed(2)+"% fark. "+
    "Kısmi alan zorla yeniden dağıtılmadı."
  );

  const report={
    year:DG_LC_YEAR,
    resolutionM:DG_LC_PIXEL_M,
    parkAreaM2,
    rasterCoverageAreaM2:result.assignedAreaM2,
    classifiedAreaM2:result.classifiedAreaM2,
    maskedAreaM2:result.maskedAreaM2,
    sourceCells:result.sourceCells,
    counts:result.counts,
    areasM2:result.areas,
    classes:Object.fromEntries(DG_LC_CLASSES.map(cls=>{
      const count=cls.codes.reduce((s,c)=>s+(result.counts[c]||0),0);
      const area=cls.codes.reduce((s,c)=>s+(result.areas[c]||0),0);
      return[cls.key,{
        label:cls.label,
        emoji:cls.emoji,
        count,
        areaM2:area,
        areaHa:area/10000,
        pct:result.assignedAreaM2>0?area/result.assignedAreaM2*100:0
      }];
    })),
    maskedPct:result.assignedAreaM2>0?result.maskedAreaM2/result.assignedAreaM2*100:0,
    classifiedPct:result.assignedAreaM2>0?result.classifiedAreaM2/result.assignedAreaM2*100:0,
    areaDeltaPct:deltaPct,
    tiles:result.tiles,
    runs:result.runs,
    cells:result.cells,
    source:"Impact Observatory · 10m Annual Land Use Land Cover V2",
    sourceUrl:"https://planetarycomputer.microsoft.com/dataset/io-lulc-annual-v02",
    license:"CC BY 4.0",
    method:"Native UTM 10 m COG + polygon/raster-cell intersection area; no cell-count-to-area normalization; no OSM class substitution."
  };

  DG_LC_LAST=report;
  dgLcRenderRuns(report.runs);
  return report;
}

function runLandCoverAnalysis(){
  if(typeof PARK_POLY==="undefined"||!PARK_POLY||!PARK_POLY.length){
    return toast("Önce park seç","warn","🌳");
  }

  const rep=$("landCoverReport");
  if(rep){
    rep.style.display="block";
    rep.innerHTML="⏳ 10 m arazi örtüsü verisi alınıyor ve park/raster hücre kesişimleri hesaplanıyor…";
  }

  const holes=typeof PARK_HOLES!=="undefined"?PARK_HOLES:[];
  const parkArea=typeof parkAreaM2==="function"?parkAreaM2():0;

  dgLcAnalyze({
    outer:PARK_POLY,
    holes,
    parkAreaM2:parkArea
  }).then(result=>{
    dgLcRenderReport(rep,result,parkArea);
    toast("✓ 2020 · 10 m arazi örtüsü zonal analizi tamamlandı.","ok","🗺️");
  }).catch(err=>{
    console.error("DENDROGEO · Arazi örtüsü analizi:",err);
    if(rep){
      rep.style.display="block";
      rep.innerHTML=
        "<b>❌ 10 m arazi örtüsü analizi tamamlanamadı.</b>"+
        "<div style='font-size:.74rem;color:var(--red);margin-top:7px'>"+esc(err?.message||String(err))+"</div>"+
        "<div style='font-size:.68rem;color:var(--mut);margin-top:7px'>Geçersiz veya eksik sonuç rapora yazılmadı.</div>";
    }
    toast("Arazi örtüsü analizi hatası: "+(err?.message||String(err)),"err","🗺️");
  });
}

function downloadLandCoverClassCSV(){
  if(!DG_LC_LAST)return toast("Önce arazi örtüsü analizini çalıştırın.","warn","🗺️");
  downloadBlob(
    "dendrogeo_landcover_2020_4class.csv",
    "text/csv;charset=utf-8",
    dgLcClassCsv(DG_LC_LAST)
  );
  toast("✓ 4 sınıf arazi örtüsü CSV'si indirildi.","ok","📥");
}

function downloadLandCoverCellsGeoJSON(){
  if(!DG_LC_LAST)return toast("Önce arazi örtüsü analizini çalıştırın.","warn","🗺️");
  downloadBlob(
    "dendrogeo_landcover_2020_10m_cells.geojson",
    "application/geo+json;charset=utf-8",
    JSON.stringify(dgLcCellsGeoJson(DG_LC_LAST),null,2)
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
window.runLandCoverAnalysis=runLandCoverAnalysis;
window.downloadLandCoverClassCSV=downloadLandCoverClassCSV;
window.downloadLandCoverCellsGeoJSON=downloadLandCoverCellsGeoJSON;
