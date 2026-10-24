"use strict";
/* Selection masks only. Final geometry is always an intersection with the park. */
(function(root){
 function frame(parent){
  const points=(parent?.outer||[]).flat();
  if(!points.length||!points.every(p=>Array.isArray(p)&&p.every(Number.isFinite)))throw Error("Park sınırı hazır değil.");
  const lat=points.reduce((s,p)=>s+p[0],0)/points.length,lon=points.reduce((s,p)=>s+p[1],0)/points.length;
  const scale=Math.max(.001,Math.cos(lat*Math.PI/180)),metres=6378137*Math.PI/180;
  return {project:p=>[(p[1]-lon)*scale*metres,(p[0]-lat)*metres],inverse:p=>[p[1]/metres+lat,p[0]/(scale*metres)+lon]};
 }
 function axes(parent,points){
  const projection=frame(parent),xy=parent.outer.flat().map(projection.project);
  let vector;
  if(points){
   if(points.length!==2||!points.every(p=>p?.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180))throw Error("Başlangıç ve bitiş için iki nokta seçin.");
   const [a,b]=points.map(projection.project),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   if(length<2)throw Error("İki sınır noktası en az 2 metre ayrı olmalı.");
   vector=[dx/length,dy/length];
  }else{
   const mx=xy.reduce((s,p)=>s+p[0],0)/xy.length,my=xy.reduce((s,p)=>s+p[1],0)/xy.length;
   let xx=0,yy=0,cross=0;for(const p of xy){xx+=(p[0]-mx)**2;yy+=(p[1]-my)**2;cross+=(p[0]-mx)*(p[1]-my);}
   const angle=.5*Math.atan2(2*cross,xx-yy);vector=[Math.cos(angle),Math.sin(angle)];
   if(vector[1]<-1e-10||(Math.abs(vector[1])<1e-10&&vector[0]<0))vector=vector.map(v=>-v);
  }
  const across=[-vector[1],vector[0]],dot=(p,v)=>p[0]*v[0]+p[1]*v[1];
  const along=xy.map(p=>dot(p,vector)),side=xy.map(p=>dot(p,across));
  const toLL=(u,v)=>projection.inverse([vector[0]*u+across[0]*v,vector[1]*u+across[1]*v]);
  return {min:Math.min(...along),max:Math.max(...along),low:Math.min(...side),high:Math.max(...side),toLL,position:p=>dot(projection.project(p),vector)};
 }
 function band(parent,axis,start,end,{polygon,clip}){
  const low=axis.low-10,high=axis.high+10;
  const ring=[[start,low],[end,low],[end,high],[start,high],[start,low]].map(p=>axis.toLL(...p));
  return {geometry:clip(ring,parent,polygon),lines:[[axis.toLL(start,low),axis.toLL(start,high)],[axis.toLL(end,low),axis.toLL(end,high)]]};
 }
 function between(parent,points,ports){
  const axis=axes(parent,points),positions=points.map(axis.position).sort((a,b)=>a-b);
  return {...band(parent,axis,positions[0],positions[1],ports),method:"two-points",label:"İki sınır arasındaki bölüm"};
 }
 function suggest(parent,count,ports){
  if(![2,3,4].includes(count))throw Error("2, 3 veya 4 bölüm seçin.");
  const flip=r=>r.map(p=>[p[1],p[0]]);
  let union=ports.polygon.union(...parent.outer.map(r=>[flip(r)]));
  if(parent.inner?.length)union=ports.polygon.difference(union,...parent.inner.map(r=>[flip(r)]));
  if(union.length>1)return union.map((part,i)=>({geometry:{outer:[flip(part[0])],inner:part.slice(1).map(flip)},lines:[],method:"separate-component",label:"Algılanan park parçası "+(i+1)}));
  const axis=axes(parent),step=(axis.max-axis.min)/count,results=[];
  if(step<2)throw Error("Park bu sayıda bölüm önermek için çok dar.");
  for(let i=0;i<count;i++){
   const start=i===0?axis.min-1:axis.min+i*step,end=i===count-1?axis.max+1:axis.min+(i+1)*step;
   try{results.push({...band(parent,axis,start,end,ports),method:"axis-proposal",label:"Önerilen bölüm "+(i+1)});}catch(error){if(!String(error.message).includes("kesişmiyor"))throw error;}
  }
  return results;
 }
 root.DG_PARK_STAGE_CUT_GEOMETRY=Object.freeze({between,suggest});
})(window);
