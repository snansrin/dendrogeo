"use strict";
/* Surface review geometry and persistence. Baseline raster remains immutable.
 * Polygon clipping operates in the raster analysis UTM CRS, including park
 * holes. User-drawn boundaries have explicit visual-review provenance. */
const DG_SURFACE_TYPES={green:{group:"green",label:"Yeşil alan"},hard:{group:"hard",label:"Sert zemin"},building:{group:"building",label:"Bina"},water:{group:"water",label:"Su"},pool:{group:"pool",label:"Havuz / süs havuzu"},bare:{group:"bare",label:"Çıplak zemin"},other:{group:"other",label:"Diğer"}};
// Millimetre snapping removes UTM round-trip noise at shared raster edges.
function dgSurfaceProject(ring,epsg){return ring.map(p=>{const q=dgLcUtmForward(p[1],p[0],epsg);return[Math.round(q.x*1000)/1000,Math.round(q.y*1000)/1000];});}
function dgSurfaceUnproject(geom,epsg){const old=DG_SURFACE_WGS_CACHE.get(geom);if(old?.epsg===epsg)return old.wgs;const wgs=geom.map(poly=>poly.map(ring=>ring.map(p=>{const q=dgLcUtmInverse(p[0],p[1],epsg);return[q.lon,q.lat];})));DG_SURFACE_WGS_CACHE.set(geom,{epsg,wgs});return wgs;}
function dgSurfaceArea(geom){let total=0;for(const poly of geom||[])for(let i=0;i<poly.length;i++){const r=poly[i];let area=0;for(let j=0;j<r.length;j++){const p=r[j],q=r[(j+1)%r.length];area+=p[0]*q[1]-q[0]*p[1];}total+=(i? -1:1)*Math.abs(area)/2;}return Math.max(0,total);}
function dgSurfacePark(outer,holes,epsg){
 const pc=window.polygonClipping;
 if(!pc)throw Error("Sınır hesaplama modülü yüklenmedi.");
 const rings=(outer||[]).filter(r=>r.length>=3).map(r=>dgSurfaceProject(r.map(p=>[p[1],p[0]]),epsg));
 if(!rings.length)throw Error("Park sınırı bulunamadı.");
 let geom=pc.union(...rings.map(r=>[r]));
 const h=(holes||[]).filter(r=>r.length>=3).map(r=>[dgSurfaceProject(r.map(p=>[p[1],p[0]]),epsg)]);
 if(h.length)geom=pc.difference(geom,...h);
 return geom;
}
function dgSurfaceCell(c,park,epsg){return window.polygonClipping.intersection([dgSurfaceProject(c.quadWgs,epsg)],park);}
async function dgSurfaceFingerprint(cells,outer,holes,meta){
 const input=JSON.stringify({outer,holes,source:meta,grid:cells.map(c=>[c.row,c.col,c.epsg,c.classKey,c.areaM2,c.quadWgs])});
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
const DG_SURFACE_MASK_CACHE=new WeakMap();
function dgSurfaceResolved(cells,classFor,geometries,features,epsg,park){
 const cached=DG_SURFACE_PART_CACHE.get(geometries);
 if(cached&&cached.park===park&&cached.epsg===epsg&&cached.cellCount===cells.length&&cached.cellFirst===cells[0]&&cached.features.length===(features||[]).length&&cached.features.every((f,i)=>f===features[i]))return cached.parts.map(p=>{if(p.method!=="review-cell")return p;const type=classFor(p.cell)||"other";return{...p,type,group:DG_SURFACE_TYPES[type]?.group||"other"};});
 const pc=window.polygonClipping,parts=[];
 const masks=(features||[]).filter(f=>DG_SURFACE_TYPES[f.type]).map(f=>{const old=DG_SURFACE_MASK_CACHE.get(f);if(old?.park===park&&old.epsg===epsg)return old.mask;const geom=pc.intersection(dgSurfaceFeatureGeometry(f,epsg),park),mask={...f,geom,bbox:dgSurfaceBounds(geom)};DG_SURFACE_MASK_CACHE.set(f,{park,epsg,mask});return mask;});
 for(const c of cells){
  const key=c.row+":"+c.col,geom=geometries[key],full=dgSurfaceArea(geom),a=Number(c.areaM2)||0;
  if(!full||!a)continue;
  let remaining=geom;const bbox=dgSurfaceBounds(geom);
  for(let i=masks.length-1;i>=0&&remaining.length;i--){
   const mask=masks[i];if(!dgSurfaceOverlap(bbox,mask.bbox))continue;const part=pc.intersection(remaining,mask.geom),partArea=dgSurfaceArea(part);
   if(partArea>0){parts.push({key,cell:c,type:mask.type,group:DG_SURFACE_TYPES[mask.type].group,geom:part,areaM2:a*partArea/full,method:mask.method||"visual-boundary",ts:mask.ts});remaining=pc.difference(remaining,mask.geom);}
  }
  if(remaining.length){const type=classFor(c)||c.classKey||"other";parts.push({key,cell:c,type,group:DG_SURFACE_TYPES[type]?.group||"other",geom:remaining,areaM2:a*dgSurfaceArea(remaining)/full,method:"review-cell"});}
 }
 dgSurfaceSeed(geometries,features||[],epsg,park,parts,cells);return parts;
}
function dgSurfaceSummarize(base,cells,classFor,geometries,features,epsg,park){
 const areas={green:0,hard:0,building:0,water:0,pool:0,bare:0,other:0,...base};
 const parts=dgSurfaceResolved(cells,classFor,geometries,features,epsg,park),seen=new Set();
 for(const p of parts){
  if(!seen.has(p.key)){const old=p.cell.classKey||"other";areas[old]=(areas[old]||0)-Number(p.cell.areaM2||0);seen.add(p.key);}
  areas[p.type]=(areas[p.type]||0)+p.areaM2;
 }
 for(const k of Object.keys(areas))if(Math.abs(areas[k])<1e-5)areas[k]=0;
 return areas;
}
function dgSurfaceValidRing(ring){
 if(!Array.isArray(ring)||ring.length<3||ring.length>300||ring.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))return false;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<ring.length;i++)for(let j=i+1;j<ring.length;j++){
  if(j===i+1||(i===0&&j===ring.length-1))continue;
  const a=ring[i],b=ring[(i+1)%ring.length],c=ring[j],d=ring[(j+1)%ring.length];
  if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1])))return false;
 }
 return true;
}
async function dgSurfaceLoadRemote(parkId,owner){
 const{data,error}=await sb.from("surface_reviews").select("payload,revision,source_fingerprint").eq("park_id",parkId).eq("owner",owner).maybeSingle();
 if(error)throw error;
 return data;
}
async function dgSurfaceSaveRemote(record,revision){
 const row={park_id:record.parkId,owner:record.owner,source_fingerprint:record.fingerprint,payload:record,revision:(revision||0)+1,updated_at:new Date().toISOString()};
 const query=revision?sb.from("surface_reviews").update(row).eq("park_id",record.parkId).eq("owner",record.owner).eq("revision",revision):sb.from("surface_reviews").insert(row);
 const{data,error}=await query.select("revision").maybeSingle();
 if(error)throw error;
 if(!data)throw Error("Kayıt başka cihazda değişti. Parkı yeniden açıp son kaydı yükleyin.");
 return data.revision;
}
window.DG_SURFACE_REVIEW={types:DG_SURFACE_TYPES,park:dgSurfacePark,cell:dgSurfaceCell,area:dgSurfaceArea,fingerprint:dgSurfaceFingerprint,summarize:dgSurfaceSummarize,resolved:dgSurfaceResolved,validRing:dgSurfaceValidRing,load:dgSurfaceLoadRemote,save:dgSurfaceSaveRemote};

function dgSurfaceBounds(geom){const pts=geom.flat(2);return pts.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);}
function dgSurfaceOverlap(a,b){return a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];}
function dgSurfaceFeatureGeometry(f,epsg){
 if(f.geometry?.type==="MultiPolygon")return f.geometry.coordinates.map(poly=>poly.map(r=>dgSurfaceProject(r,epsg)));
 return dgSurfaceValidRing(f.ring)?[ [dgSurfaceProject(f.ring,epsg)] ]:[];
}
function dgSurfaceObjects(elements,epsg){
 const out=[];const paved=/^(asphalt|paved|concrete|paving_stones|sett|cobblestone|bricks|concrete:plates|concrete:lanes)$/;
 for(const el of elements||[]){
  const t=el.tags||{};let type=null;const deck=/^(pier|bridge)$/.test(t.man_made||"")||t.bridge==="yes";
  if((t.building&&t.building!=="no")||(t["building:part"]&&t["building:part"]!=="no"))type="building";
  else if(t.leisure==="swimming_pool"||t.amenity==="fountain"||t.water==="reflecting_pool")type="pool";
  else if(t.natural==="water"||t.water||t.landuse==="reservoir"||t.waterway==="riverbank")type="water";
  else if(deck||paved.test(t.surface||"")||t.amenity==="parking")type="hard";
  if(!type)continue;
  let geom=[];
  if(el.type==="relation"&&typeof extractRings==="function"){
   const rs=extractRings(el);if(rs){const outer=Array.isArray(rs)?rs:rs.outer,holes=Array.isArray(rs)?[]:rs.inner||[];if(outer?.length)geom=dgSurfacePark(outer,holes,epsg);}
  }else if(el.geometry?.length>=2){
   const pts=el.geometry.map(p=>[p.lon,p.lat]),a=pts[0],b=pts.at(-1);
   if(pts.length>=4&&a[0]===b[0]&&a[1]===b[1])geom=[[dgSurfaceProject(pts,epsg)]];
   else if(type==="hard"&&(deck||paved.test(t.surface||""))){
    const width=Number(t.width);if(Number.isFinite(width)&&width>0&&width<=40){
     const xy=dgSurfaceProject(pts,epsg),segments=[];
     for(let i=1;i<xy.length;i++){const a=xy[i-1],b=xy[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)continue;const ox=-dy/len*width/2,oy=dx/len*width/2;segments.push([[[a[0]+ox,a[1]+oy],[b[0]+ox,b[1]+oy],[b[0]-ox,b[1]-oy],[a[0]-ox,a[1]-oy],[a[0]+ox,a[1]+oy]]]);}
     if(segments.length)geom=window.polygonClipping.union(...segments);
    }
   }
  }
  if(geom.length)out.push({type,method:"osm-boundary",osmId:el.type+"/"+el.id,priority:deck?4:null,geometry:{type:"MultiPolygon",coordinates:dgSurfaceUnproject(geom,epsg)}});
 }
 const priority={hard:0,water:1,pool:2,building:3};return out.sort((a,b)=>(a.priority??priority[a.type])-(b.priority??priority[b.type]));
}
window.DG_SURFACE_REVIEW.objects=dgSurfaceObjects;

const DG_SURFACE_PART_CACHE=new WeakMap();
const DG_SURFACE_WGS_CACHE=new WeakMap();
function dgSurfaceSeed(geometries,features,epsg,park,parts,cells){
 DG_SURFACE_PART_CACHE.set(geometries,{features:features.slice(),epsg,park,parts,cellCount:cells?.length,cellFirst:cells?.[0]});
 for(const p of parts)if(p.wgs)DG_SURFACE_WGS_CACHE.set(p.geom,{epsg,wgs:p.wgs});
}
const DG_SURFACE_JOBS=new Set();
function dgSurfaceCancelJobs(){for(const cancel of [...DG_SURFACE_JOBS])cancel();}
function dgSurfaceWorkerJob(data){
 return new Promise((resolve,reject)=>{
  if(typeof Worker==='undefined'){resolve(null);return;}
  let worker;try{worker=new Worker('/src/workers/surface-worker.js?v='+(typeof dgRuntimeBuild==='function'?encodeURIComponent(dgRuntimeBuild()):'current'));}catch(e){resolve(null);return;}
  const finish=()=>{clearTimeout(timer);worker.terminate();DG_SURFACE_JOBS.delete(cancel);};
  const cancel=()=>{finish();reject(Error('Analiz kapatıldı.'));};
  const timer=setTimeout(()=>{finish();reject(Error('Sınır hesabı zaman aşımına uğradı.'));},90000);
  DG_SURFACE_JOBS.add(cancel);
  worker.onmessage=e=>{finish();if(e.data.error)reject(Error(e.data.error));else resolve(e.data);};
  worker.onerror=()=>{finish();resolve(null);};
  try{worker.postMessage(data);}catch(e){finish();reject(e);}
 });
}
async function dgSurfacePrepare(data){
 const result=await dgSurfaceWorkerJob(data);if(result)return result;
 // Older browsers / worker load failures: yield between bounded geometry batches.
 const park=dgSurfacePark(data.outer,data.holes,data.epsg),geometries={},parts=[];
 const objects=data.objects||dgSurfaceObjects(data.elements||[],data.epsg);
 const features=[...(data.useObjects!==false?objects:[]),...data.features];
 for(let i=0;i<data.cells.length;i+=128){const batch=data.cells.slice(i,i+128);for(const c of batch)geometries[c.row+':'+c.col]=dgSurfaceCell(c,park,data.epsg);parts.push(...dgSurfaceResolved(batch,c=>c.classKey,geometries,features,data.epsg,park));await new Promise(r=>setTimeout(r,0));}
 return{park,geometries,objects,parts};
}
function dgSurfaceMergeSync(parts,epsg){
 const groups={};for(const p of parts){const g=groups[p.type]||(groups[p.type]={geoms:[],area:0,methods:new Set()});g.geoms.push(p.geom);g.area+=p.areaM2;g.methods.add(p.method);}
 return Object.entries(groups).map(([k,g])=>({type:'Feature',properties:{class:k,area_m2:g.area,method:[...g.methods].sort().join('+')},geometry:{type:'MultiPolygon',coordinates:dgSurfaceUnproject(window.polygonClipping.union(...g.geoms),epsg)}}));
}

function dgSurfaceDisplaySync(parts,epsg,park,prepared=null){
 const exact=prepared||dgSurfaceMergeSync(parts,epsg),pc=globalThis.DG_DISPLAY_CLIP||window.polygonClipping;
 if(!globalThis.DG_SURFACE_DISPLAY||!exact.length)return exact;
 const source=exact.map(f=>dgSurfaceFeatureGeometry(f,epsg));
 const origin=source.flat(3)[0];if(!origin)return exact;
 // Local metre coordinates avoid cancellation and clipping noise at UTM
 // eastings/northings. Neither accepted features nor analytic areas are edited.
 const shift=(g,sign)=>g.map(poly=>poly.map(r=>r.map(p=>[sign<0?Math.round((p[0]-origin[0])*1000)/1000:p[0]+origin[0],sign<0?Math.round((p[1]-origin[1])*1000)/1000:p[1]+origin[1]])));
 const raw=source.map(g=>shift(g,-1)),vectors=parts.filter(p=>p.method!=="review-cell");
 try{
  const domain=pc.union(...raw),fixed=[];let reserved=[];
  for(let i=0;i<exact.length;i++){
   const g=vectors.filter(p=>p.type===exact[i].properties.class).map(p=>shift(p.geom,-1));
   const mask=g.length?pc.difference(pc.intersection(pc.union(...g),raw[i],domain),reserved):[];
   fixed.push(mask);reserved=pc.union(reserved,mask);
  }
  const edges=[];for(const geom of [...fixed,shift(park||[],-1)])for(const poly of geom)for(const r of poly)for(let i=1;i<r.length;i++)edges.push([r[i-1],r[i]]);
  const objects=reserved,visual=raw.map(()=>[]);let claimed=objects;
  const order=exact.map((f,i)=>i).sort((a,b)=>(exact[a].properties.class==="green")-(exact[b].properties.class==="green"));
  for(let n=0;n<order.length;n++){
   const i=order[n],remaining=pc.difference(domain,claimed);let fill=remaining;
   if(n<order.length-1){
    const raster=pc.difference(raw[i],objects),rounded=raster.map(poly=>poly.map(r=>DG_SURFACE_DISPLAY.ring(r,edges,8)));
    // Repair each component independently so one narrow contour cannot force
    // every class back to the raw raster outline.
    const pieces=[];for(let k=0;k<rounded.length;k++){try{pieces.push(pc.intersection(remaining,[rounded[k]]));}catch(e){pieces.push(pc.intersection(remaining,[raster[k]]));}}
    fill=pieces.length?pc.union(...pieces):[];
   }
   visual[i]=pc.union(fill,fixed[i]);claimed=pc.union(claimed,visual[i]);
  }
  const originalArea=dgSurfaceArea(domain);
  if(Math.abs(dgSurfaceArea(pc.union(...visual))-originalArea)>Math.max(.1,originalArea*.000001))throw Error("Görsel park kapsamı doğrulanamadı.");
  for(let i=0;i<visual.length;i++)for(let j=i+1;j<visual.length;j++){const overlap=dgSurfaceArea(pc.intersection(visual[i],visual[j]));if(overlap>Math.max(1,originalArea*.000002))throw Error("Görsel sınıf sınırları örtüşüyor: "+i+","+j+" "+overlap);}
  return exact.map((f,i)=>({...f,geometry:{type:'MultiPolygon',coordinates:dgSurfaceUnproject(shift(visual[i],1),epsg)}}));
 }catch(e){throw Error("Yumuşak yüzey çizimi üretilemedi: "+String(e.message||e));}
}

/* Sampling geometry is derived from the displayed review, never from patch centroids.
 * Erode the usable domain, clip metric cells, then choose an interior point.
 * The final point has an exact boundary-distance check after coordinate rounding. */
function dgGridPointDistance(p,geom){
 let inside=false,min=Infinity;
 for(const poly of geom){let inPoly=false;for(let i=0;i<poly.length;i++){const ring=poly[i];let hit=false;for(let j=0,k=ring.length-1;j<ring.length;k=j++){
  const a=ring[k],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  min=Math.min(min,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
 }if(i===0)inPoly=hit;else if(hit)inPoly=false;}if(inPoly)inside=true;}
 return inside?min:-min;
}
function dgGridInterior(poly){
 const b=dgSurfaceBounds([poly]);let best=null;
 const make=(x,y,h)=>{const d=dgGridPointDistance([x,y],[poly]);return{x,y,h,d,max:d+h*Math.SQRT2};};
 const queue=[make((b[0]+b[2])/2,(b[1]+b[3])/2,Math.max(b[2]-b[0],b[3]-b[1])/2)];
 // Bounded best-first subdivision. Cell dimensions are at most 50 m.
 for(let n=0;queue.length&&n<2048;n++){
  queue.sort((a,b)=>b.max-a.max);const c=queue.shift();if(!best||c.d>best.d)best=c;
  if(c.max-best.d<=.15||c.h<=.075)continue;
  const h=c.h/2;for(const dx of [-h,h])for(const dy of [-h,h])queue.push(make(c.x+dx,c.y+dy,h));
 }
 return best?.d>0?[best.x,best.y]:null;
}
function dgGridLineMask(line,epsg){
 const pts=dgSurfaceProject(line.pts.map(p=>[p[1],p[0]]),epsg),width=Math.max(.1,Number(line.w)||1),out=[];
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)continue;const ox=-dy/len*width,oy=dx/len*width;out.push([[[a[0]+ox,a[1]+oy],[b[0]+ox,b[1]+oy],[b[0]-ox,b[1]-oy],[a[0]-ox,a[1]-oy],[a[0]+ox,a[1]+oy]]]);}
 for(const p of pts)out.push([Array.from({length:17},(_,i)=>[p[0]+Math.cos(i*Math.PI/8)*width,p[1]+Math.sin(i*Math.PI/8)*width])]);
 return out;
}
/* Local millimetre precision prevents UTM floating-point slivers accumulating
 * across repeated offset intersections. Never widen geometry after a failure. */
function dgSurfaceClean(geom){
 if(typeof geom?.[0]?.[0]?.[0]==="number")geom=[geom];
 const clean=[];
 for(const poly of geom||[]){const rings=[];for(let i=0;i<poly.length;i++){
  const out=[];for(const p of poly[i]){const q=[Math.round(p[0]*1000)/1000,Math.round(p[1]*1000)/1000];if(!out.length||q[0]!==out.at(-1)[0]||q[1]!==out.at(-1)[1])out.push(q);}
  if(out.length&&(out[0][0]!==out.at(-1)[0]||out[0][1]!==out.at(-1)[1]))out.push([...out[0]]);
  if(out.length<4){if(i===0)break;continue;}rings.push(out);
 }if(rings.length&&dgSurfaceArea([rings])>.000001)clean.push(rings);}
 return clean;
}
function dgGridPrecisionClip(op,...geoms){return dgSurfaceClean(window.polygonClipping[op](...geoms.map(dgSurfaceClean)));}
async function dgSurfaceGrid(data){
 const pc={union:(...g)=>dgGridPrecisionClip("union",...g),difference:(...g)=>dgGridPrecisionClip("difference",...g),intersection:(...g)=>dgGridPrecisionClip("intersection",...g)},size=Number(data.size),clearance=Number(data.clearance),epsg=data.epsg;
 if(![10,20,50].includes(size)||!Number.isFinite(clearance)||clearance<1||clearance>20)throw Error('Grid boyutu veya güvenlik mesafesi geçersiz.');
 const globalPark=dgSurfacePark(data.outer,data.holes||[],epsg),origin=dgSurfaceBounds(globalPark).slice(0,2).map(v=>Math.floor(v));
 const local=g=>dgSurfaceClean(g.map(poly=>poly.map(r=>r.map(p=>[p[0]-origin[0],p[1]-origin[1]]))));
 const global=g=>g.map(poly=>poly.map(r=>r.map(p=>[p[0]+origin[0],p[1]+origin[1]])));
 const park=local(globalPark);
 const greens=(data.parts||[]).filter(p=>p.type==='green'&&p.geom?.length).map(p=>local(p.geom));
 if(data.greenOnly&&!greens.length)throw Error('Yeşil alan bulunamadı. Yüzey analizini kontrol edin.');
 let domain=data.greenOnly?pc.union(...greens):park;
 const obstacles=(data.blockRings||[]).filter(r=>r.length>=3).map(r=>local([[dgSurfaceProject(r.map(p=>[p[1],p[0]]),epsg)]]));
 if(!data.greenOnly)for(const p of data.parts||[])if(p.type!=='green')obstacles.push(local(p.geom));
 for(const line of data.blockLines||[])if(line.pts?.length>=2)obstacles.push(local(dgGridLineMask(line,epsg)));
 if(obstacles.length)domain=pc.difference(domain,...obstacles);
 domain=pc.intersection(domain,park);
 if(!domain.length)return{cells:[],epsg,size,clearance,areaM2:0};
 let safe=domain;
 const radius=(clearance+.15)/Math.cos(Math.PI/16);
 for(let i=0;i<16&&safe.length;i++){const dx=Math.cos(i*Math.PI/8)*radius,dy=Math.sin(i*Math.PI/8)*radius;safe=pc.intersection(safe,domain.map(poly=>poly.map(ring=>ring.map(p=>[Math.round((p[0]+dx)*1000)/1000,Math.round((p[1]+dy)*1000)/1000]))));if(i%4===3)await new Promise(r=>setTimeout(r,0));}
 if(!safe.length)return{cells:[],epsg,size,clearance,areaM2:0};
 const bounds=dgSurfaceBounds(park),x0=Math.floor((bounds[0]+origin[0])/size)*size-origin[0],y0=Math.floor((bounds[1]+origin[1])/size)*size-origin[1],nx=Math.ceil((bounds[2]-x0)/size),ny=Math.ceil((bounds[3]-y0)/size);
 if(nx*ny>30000)throw Error('Park zarfı çok geniş. Daha büyük grid boyutu seçin.');
 const islands=safe.map(poly=>({poly,bbox:dgSurfaceBounds([poly])})),cells=[];
 for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
  const x=x0+col*size,y=y0+row*size,bb=[x,y,x+size,y+size],near=islands.filter(p=>dgSurfaceOverlap(bb,p.bbox));if(!near.length)continue;
  const quad=[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]],geom=pc.intersection(near.map(p=>p.poly),[quad]);
  const components=geom.filter(poly=>dgSurfaceArea([poly])>=1);
  for(let component=0;component<components.length;component++){
  const piece=[components[component]];
  let point=[x+size/2,y+size/2];
  if(dgGridPointDistance(point,piece)<=0)point=dgGridInterior(components[component]);
  if(!point)continue;
  const ll=dgLcUtmInverse(point[0]+origin[0],point[1]+origin[1],epsg),lat=+ll.lat.toFixed(6),lon=+ll.lon.toFixed(6),rounded=dgSurfaceProject([[lon,lat]],epsg)[0].map((v,i)=>v-origin[i]);
  const distance=dgGridPointDistance(rounded,domain);if(distance<clearance||dgGridPointDistance(rounded,piece)<0)continue;
  const wgs=dgSurfaceUnproject(global(piece),epsg),corners=quad.map(p=>dgLcUtmInverse(p[0]+origin[0],p[1]+origin[1],epsg)),baseId=row+'_'+col;
  cells.push({id:baseId+(components.length>1?'_'+component:''),baseId,row,col,lat,lon,n:0,s0:Math.min(...corners.map(p=>p.lat)),s1:Math.max(...corners.map(p=>p.lat)),w0:Math.min(...corners.map(p=>p.lon)),w1:Math.max(...corners.map(p=>p.lon)),geometry:{type:'MultiPolygon',coordinates:wgs},areaM2:dgSurfaceArea(piece),clearanceM:distance});
  }
  if(cells.length>10000)throw Error('Grid çok yoğun. Daha büyük grid boyutu seçin.');
  if(cells.length%64===0)await new Promise(r=>setTimeout(r,0));
 }
 return{cells,epsg,size,clearance,x0:x0+origin[0],y0:y0+origin[1],areaM2:dgSurfaceArea(safe)};
}
