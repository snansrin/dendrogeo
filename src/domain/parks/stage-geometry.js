"use strict";
/* Stage-only geometry policy. Existing park geometry/math stays unchanged. */
(function(root){
 const copy=value=>JSON.parse(JSON.stringify(value));
 function validateRing(ring){
  if(!Array.isArray(ring)||ring.length<4||ring.length>301)return false;
  if(!ring.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180))return false;
  const key=p=>p.join(","),points=ring.slice(0,-1);
  if(key(ring[0])!==key(ring.at(-1))||new Set(points.map(key)).size!==points.length)return false;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-14&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   if(j===i+1||(i===0&&j===points.length-1))continue;
   const a=ring[i],b=ring[i+1],c=ring[j],d=ring[j+1];
   if((cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))return false;
  }
  return Math.abs(points.reduce((sum,p,i)=>sum+p[1]*ring[i+1][0]-ring[i+1][1]*p[0],0))>1e-12;
 }
 function clip(ring,parent,polygon){
  if(!validateRing(ring))throw Error("En az üç ayrı köşeli, kesişmeyen bir etap sınırı çizin.");
  if(!parent?.outer?.length)throw Error("Ana parkın sınırı bulunamadı.");
  const flip=r=>r.map(p=>[p[1],p[0]]);
  let mask=polygon.union(...parent.outer.map(r=>[flip(r)]));
  if(parent.inner?.length)mask=polygon.difference(mask,...parent.inner.map(r=>[flip(r)]));
  const result=polygon.intersection([[flip(ring)]],mask);
  if(!result.length)throw Error("Etap park alanıyla kesişmiyor.");
  const geometry={outer:[],inner:[]};
  for(const part of result){geometry.outer.push(flip(part[0]));part.slice(1).forEach(r=>geometry.inner.push(flip(r)));}
  return geometry;
 }
 function candidate(row){
  const scope=row?.geom_json?.stage_scope;
  if(!/^stage\/\d+\/[a-f0-9]{32}$/.test(row?.osm_key||"")||scope?.schema!=="dendrogeo/park-stage/1"||!String(row.osm_key).startsWith("stage/"+scope.parentId+"/")||!row.geom_json.outer?.length)throw Error("Etap kaydı geçersiz.");
  return {name:row.name,type:"manual",source:"manual",rings:copy({outer:row.geom_json.outer,inner:row.geom_json.inner||[]}),area:row.area_m2,stageRow:copy(row)};
 }
 function fence(fix,park,config,contains){
  if(!String(park?.osm_key||"").startsWith("stage/"))return null;
  const result={ok:false,verified:false,inside:false,reason:"outside",distM:null,acc:fix?.acc??null};
  if(!fix||!Number.isFinite(fix.lat)||!Number.isFinite(fix.lon)||Math.abs(fix.lat)>90||Math.abs(fix.lon)>180)return {...result,reason:"no-fix"};
  if(!Number.isFinite(fix.acc)||fix.acc<0||fix.acc>config.ACC_MAX_M)return {...result,reason:"acc"};
  if(!park.geom_json?.stage_scope||!park.geom_json?.outer?.length)return {...result,reason:"no-geom"};
  return contains(+fix.lat,+fix.lon,park.geom_json)?{...result,ok:true,verified:true,inside:true,reason:"inside"}:result;
 }
 function measurementGate({park,project,editId}){return !editId&&String(park?.osm_key||"").startsWith("stage/")&&Number(project?.park_id)!==Number(park.id)?{allowed:false,reason:"stage-project-required",project}:null;}
 root.DG_PARK_STAGE_GEOMETRY=Object.freeze({validateRing,clip,candidate,fence,measurementGate});
})(window);
