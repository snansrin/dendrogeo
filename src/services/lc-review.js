"use strict";
/* Surface review geometry and persistence. Baseline raster remains immutable.
 * Polygon clipping operates in the raster analysis UTM CRS, including park
 * holes. User-drawn boundaries have explicit visual-review provenance. */
const DG_SURFACE_TYPES=window.DG_SURFACE_REVIEW_CONTRACTS.types;
const DG_SURFACE_REVIEW_GEOMETRY=window.DG_SURFACE_REVIEW_GEOMETRY;
// Millimetre snapping removes UTM round-trip noise at shared raster edges.
function dgSurfaceProject(ring,epsg){return ring.map(p=>{const q=dgLcUtmForward(p[1],p[0],epsg);return[Math.round(q.x*1000)/1000,Math.round(q.y*1000)/1000];});}
function dgSurfaceUnproject(geom,epsg){const old=DG_SURFACE_WGS_CACHE.get(geom);if(old?.epsg===epsg)return old.wgs;const wgs=geom.map(poly=>poly.map(ring=>ring.map(p=>{const q=dgLcUtmInverse(p[0],p[1],epsg);return[q.lon,q.lat];})));DG_SURFACE_WGS_CACHE.set(geom,{epsg,wgs});return wgs;}
function dgSurfaceArea(geom){return DG_SURFACE_REVIEW_GEOMETRY.area(geom);}
function dgSurfaceClip(op,...geoms){
 const pc=window.polygonClipping;if(!pc||typeof pc[op]!=="function")throw Error("Sınır hesaplama modülü yüklenmedi.");
 const input=geoms.map(dgSurfaceClean),points=input.flat(3);
 if(!points.length)return [];
 // polygon-clipping's sweep line uses floating-point event ordering. UTM
 // coordinates around 4,400,000 m lose useful precision in that ordering even
 // though the input is already snapped to millimetres. Translate every operand
 // by the same whole-metre origin before overlay, then restore it exactly.
 // Integer translation preserves all snapped coordinates and polygon areas.
 const origin=points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1])],[Infinity,Infinity]),ox=Math.floor(origin[0]),oy=Math.floor(origin[1]);
 const shift=(geom,dx,dy)=>geom.map(poly=>poly.map(ring=>ring.map(p=>[p[0]+dx,p[1]+dy])));
 const local=input.map(g=>shift(g,-ox,-oy));
 try{return shift(dgSurfaceClean(pc[op](...local)),ox,oy);}
 catch(e){if(!/Unable to find segment|SweepLine tree|Unable to complete output ring/i.test(String(e?.message||e)))throw e;throw Error("Sınır geometrisi sayısal olarak kararsız; tarama güvenli biçimde durduruldu. Park sınırını veya çakışan OSM geometrisini düzeltip yeniden deneyin.");}
}
function dgSurfacePark(outer,holes,epsg){
 const pc=window.polygonClipping;
 if(!pc)throw Error("Sınır hesaplama modülü yüklenmedi.");
 const rings=(outer||[]).filter(r=>r.length>=3).map(r=>dgSurfaceProject(r.map(p=>[p[1],p[0]]),epsg));
 if(!rings.length)throw Error("Park sınırı bulunamadı.");
 let geom=dgSurfaceClip("union",...rings.map(r=>[r]));
 const h=(holes||[]).filter(r=>r.length>=3).map(r=>[dgSurfaceProject(r.map(p=>[p[1],p[0]]),epsg)]);
 if(h.length)geom=dgSurfaceClip("difference",geom,...h);
 return geom;
}
function dgSurfaceCell(c,park,epsg){return dgSurfaceClip("intersection",[dgSurfaceProject(c.quadWgs,epsg)],park);}
async function dgSurfaceFingerprint(cells,outer,holes,meta){
 const input=JSON.stringify({outer,holes,source:meta,grid:cells.map(c=>[c.row,c.col,c.epsg,c.classKey,c.areaM2,c.quadWgs])});
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
const DG_SURFACE_MASK_CACHE=new WeakMap();
function dgSurfaceResolved(cells,classFor,geometries,features,epsg,park){
 if(!Array.isArray(cells)||!cells.length||!geometries||typeof geometries!=="object"||!Array.isArray(park)||!park.length)return [];
 const cached=DG_SURFACE_PART_CACHE.get(geometries);
 if(cached&&cached.park===park&&cached.epsg===epsg&&cached.cellCount===cells.length&&cached.cellFirst===cells[0]&&cached.features.length===(features||[]).length&&cached.features.every((f,i)=>f===features[i]))return cached.parts.map(p=>{if(p.method!=="review-cell")return p;const type=classFor(p.cell)||"other";return{...p,type,group:DG_SURFACE_TYPES[type]?.group||"other"};});
 const parts=[];
 const masks=(features||[]).filter(f=>DG_SURFACE_TYPES[f.type]).map(f=>{const old=DG_SURFACE_MASK_CACHE.get(f);if(old?.park===park&&old.epsg===epsg)return old.mask;const geom=dgSurfaceClip("intersection",dgSurfaceFeatureGeometry(f,epsg),park),mask={...f,geom,bbox:dgSurfaceBounds(geom)};DG_SURFACE_MASK_CACHE.set(f,{park,epsg,mask});return mask;});
 for(const c of cells){
  const key=c.row+":"+c.col,geom=geometries[key],full=dgSurfaceArea(geom),a=Number(c.areaM2)||0;
  if(!full||!a)continue;
  let remaining=geom;const bbox=dgSurfaceBounds(geom);
  for(let i=masks.length-1;i>=0&&remaining.length;i--){
   const mask=masks[i];if(!dgSurfaceOverlap(bbox,mask.bbox))continue;const part=dgSurfaceClip("intersection",remaining,mask.geom),partArea=dgSurfaceArea(part);
   if(partArea>0){parts.push({key,cell:c,type:mask.type,group:DG_SURFACE_TYPES[mask.type].group,geom:part,areaM2:a*partArea/full,method:mask.method||"visual-boundary",ts:mask.ts});remaining=dgSurfaceClip("difference",remaining,mask.geom);}
  }
  if(remaining.length){const type=classFor(c)||c.classKey||"other";parts.push({key,cell:c,type,group:DG_SURFACE_TYPES[type]?.group||"other",geom:remaining,areaM2:a*dgSurfaceArea(remaining)/full,method:"review-cell"});}
 }
 dgSurfaceSeed(geometries,features||[],epsg,park,parts,cells);return parts;
}
function dgSurfaceSummarize(base,cells,classFor,geometries,features,epsg,park){
 return dgSurfaceSummarizeParts(base,dgSurfaceResolved(cells,classFor,geometries,features,epsg,park));
}
function dgSurfaceSummarizeParts(base,parts){
 const areas={green:0,hard:0,building:0,water:0,pool:0,bare:0,other:0,...base},seen=new Set();
 for(const p of parts){
  if(!seen.has(p.key)){const old=p.cell.classKey||"other";areas[old]=(areas[old]||0)-Number(p.cell.areaM2||0);seen.add(p.key);}
  areas[p.type]=(areas[p.type]||0)+p.areaM2;
 }
 for(const k of Object.keys(areas))if(Math.abs(areas[k])<1e-5)areas[k]=0;
 return areas;
}
function dgSurfaceValidRing(ring){return window.DG_SURFACE_REVIEW_CONTRACTS.isValidRing(ring);}
async function dgSurfaceLoadRemote(parkId,owner){
 return window.DG_SURFACE_REVIEW_STORE.load(sb,parkId,owner);
}
async function dgSurfaceSaveRemote(record,revision){
 return window.DG_SURFACE_REVIEW_STORE.save(sb,record,revision);
}
window.DG_SURFACE_REVIEW={types:DG_SURFACE_TYPES,park:dgSurfacePark,cell:dgSurfaceCell,area:dgSurfaceArea,fingerprint:dgSurfaceFingerprint,summarize:dgSurfaceSummarize,resolved:dgSurfaceResolved,validRing:dgSurfaceValidRing,load:dgSurfaceLoadRemote,save:dgSurfaceSaveRemote};

function dgSurfaceBounds(geom){return DG_SURFACE_REVIEW_GEOMETRY.bounds(geom);}
function dgSurfaceOverlap(a,b){return DG_SURFACE_REVIEW_GEOMETRY.overlap(a,b);}
function dgSurfaceFeatureGeometry(f,epsg){
 if(f.geometry?.type==="MultiPolygon")return f.geometry.coordinates.map(poly=>poly.map(r=>dgSurfaceProject(r,epsg)));
 return dgSurfaceValidRing(f.ring)?[ [dgSurfaceProject(f.ring,epsg)] ]:[];
}
const DG_SURFACE_OSM_REVIEW_OBJECTS=window.DG_SURFACE_OSM_REVIEW_ADAPTER.create({
 projectRing:dgSurfaceProject,unprojectGeometry:dgSurfaceUnproject,parkGeometry:dgSurfacePark,
 clip:dgSurfaceClip,gridLineMask:(line,epsg)=>dgGridLineMask(line,epsg),
 extractRings:el=>typeof extractRings==="function"?extractRings(el):null
});
function dgSurfaceObjects(elements,epsg){return DG_SURFACE_OSM_REVIEW_OBJECTS(elements,epsg);}
window.DG_SURFACE_REVIEW.objects=dgSurfaceObjects;

const DG_SURFACE_PART_CACHE=new WeakMap();
const DG_SURFACE_WGS_CACHE=new WeakMap();
function dgSurfaceSeed(geometries,features,epsg,park,parts,cells){
 DG_SURFACE_PART_CACHE.set(geometries,{features:features.slice(),epsg,park,parts,cellCount:cells?.length,cellFirst:cells?.[0]});
 for(const p of parts)if(p.wgs)DG_SURFACE_WGS_CACHE.set(p.geom,{epsg,wgs:p.wgs});
}
const DG_SURFACE_REVIEW_WORKER=window.DG_SURFACE_REVIEW_WORKER_ADAPTER.create({
 getWorker:()=>typeof Worker==="undefined"?null:Worker,
 scriptUrl:()=>typeof dgRuntimeScriptUrl==="function"?dgRuntimeScriptUrl("/src/workers/surface-worker.js"):"/src/workers/surface-worker.js"
});
function dgSurfaceCancelJobs(){DG_SURFACE_REVIEW_WORKER.cancelAll();}
function dgSurfaceWorkerJob(data){return DG_SURFACE_REVIEW_WORKER.run(data);}
const DG_SURFACE_REVIEW_PREPARE=window.DG_SURFACE_REVIEW_PREPARATION.create({
 runWorker:dgSurfaceWorkerJob,park:dgSurfacePark,objects:dgSurfaceObjects,cell:dgSurfaceCell,
 resolved:dgSurfaceResolved,yieldTask:()=>new Promise(r=>setTimeout(r,0))
});
function dgSurfacePrepare(data){return DG_SURFACE_REVIEW_PREPARE(data);}
function dgSurfaceMergeSync(parts,epsg){
 const groups={};for(const p of parts){const g=groups[p.type]||(groups[p.type]={geoms:[],area:0,methods:new Set()});g.geoms.push(p.geom);g.area+=p.areaM2;g.methods.add(p.method);}
 return Object.entries(groups).map(([k,g])=>({type:'Feature',properties:{class:k,area_m2:g.area,method:[...g.methods].sort().join('+')},geometry:{type:'MultiPolygon',coordinates:dgSurfaceUnproject(dgSurfaceClip("union",...g.geoms),epsg)}}));
}

function dgSurfaceDisplaySync(parts,epsg,park,prepared=null){
 // The user requested the original exact map, without display smoothing.
 // Reuse the already merged analytical features; no second topology pass.
 return prepared||dgSurfaceMergeSync(parts,epsg);
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

// Reviewed brush footprints survive account/draft reloads, with bounded numeric geometry.
function dgSurfaceValidFeature(f){
 return window.DG_SURFACE_REVIEW_CONTRACTS.isValidFeature(f);
}
window.DG_SURFACE_REVIEW.validFeature=dgSurfaceValidFeature;
