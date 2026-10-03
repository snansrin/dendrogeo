"use strict";
/* Surface review geometry and persistence. Baseline raster remains immutable.
 * Polygon clipping operates in the raster analysis UTM CRS, including park
 * holes. User-drawn boundaries have explicit visual-review provenance. */
const DG_SURFACE_TYPES={green:{group:"green",label:"Yeşil alan"},hard:{group:"hard",label:"Sert / yapılı alan"},building:{group:"hard",label:"Bina"},water:{group:"water",label:"Su"},pool:{group:"water",label:"Havuz / süs havuzu"},bare:{group:"bare",label:"Çıplak zemin"},other:{group:"other",label:"Diğer"}};
function dgSurfaceProject(ring,epsg){return ring.map(p=>{const q=dgLcUtmForward(p[1],p[0],epsg);return[q.x,q.y];});}
function dgSurfaceUnproject(geom,epsg){return geom.map(poly=>poly.map(ring=>ring.map(p=>{const q=dgLcUtmInverse(p[0],p[1],epsg);return[q.lon,q.lat];})));}
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
function dgSurfaceResolved(cells,classFor,geometries,features,epsg,park){
 const pc=window.polygonClipping,parts=[];
 const masks=(features||[]).filter(f=>DG_SURFACE_TYPES[f.type]&&dgSurfaceValidRing(f.ring)).map(f=>({...f,geom:pc.intersection([dgSurfaceProject(f.ring,epsg)],park)}));
 for(const c of cells){
  const key=c.row+":"+c.col,geom=geometries[key],full=dgSurfaceArea(geom),a=Number(c.areaM2)||0;
  if(!full||!a)continue;
  let remaining=geom;
  for(let i=masks.length-1;i>=0&&remaining.length;i--){
   const mask=masks[i],part=pc.intersection(remaining,mask.geom),partArea=dgSurfaceArea(part);
   if(partArea>0){parts.push({key,cell:c,type:mask.type,group:DG_SURFACE_TYPES[mask.type].group,geom:part,areaM2:a*partArea/full,method:"visual-boundary",ts:mask.ts});remaining=pc.difference(remaining,mask.geom);}
  }
  if(remaining.length){const type=classFor(c)||c.classKey||"other";parts.push({key,cell:c,type,group:DG_SURFACE_TYPES[type]?.group||"other",geom:remaining,areaM2:a*dgSurfaceArea(remaining)/full,method:"review-cell"});}
 }
 return parts;
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
