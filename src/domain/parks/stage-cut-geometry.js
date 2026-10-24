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
 function betweenCuts(parent,cuts,ports){
  if(!Array.isArray(cuts)||cuts.length!==2||!cuts.every(line=>Array.isArray(line)&&line.length===2&&line.every(p=>p?.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180)))throw Error("Her sınır için iki referans noktası seçin.");
  const projection=frame(parent),xy=parent.outer.flat().map(projection.project),lines=cuts.map(line=>line.map(projection.project));
  const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const mid=line=>[(line[0][0]+line[1][0])/2,(line[0][1]+line[1][1])/2];
  const lengths=lines.map(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1]));
  if(lengths.some(n=>n<2))throw Error("Aynı sınırın iki referansı en az 2 metre ayrı olmalı.");
  const directions=lines.map(([a,b],i)=>cross(a,b,mid(lines[1-i])));
  if(directions.some((n,i)=>Math.abs(n)/lengths[i]<2))throw Error("Başlangıç ve bitiş sınırlarını birbirinden ayırın.");
  // A crossing inside the park has no unambiguous 'between'; never silently choose a wedge.
  const [a,b]=lines[0],[c,d]=lines[1],den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]);
  if(Math.abs(den)>1e-8){
   const t=((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den,point=projection.inverse([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
   const contains=ring=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const p=ring[i],q=ring[j];if((p[0]>point[0])!==(q[0]>point[0])&&point[1]<(q[1]-p[1])*(point[0]-p[0])/(q[0]-p[0])+p[1])inside=!inside;}return inside;};
   if(parent.outer.some(contains)&&!(parent.inner||[]).some(contains))throw Error("Sınırlar park içinde kesişiyor. Referansları köprü doğrultusunda ayarlayın.");
  }
  const minX=Math.min(...xy.map(p=>p[0]))-10,maxX=Math.max(...xy.map(p=>p[0]))+10,minY=Math.min(...xy.map(p=>p[1]))-10,maxY=Math.max(...xy.map(p=>p[1]))+10;
  let mask=[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]];
  lines.forEach(([a,b],index)=>{
   const input=mask;mask=[];const distance=p=>cross(a,b,p)*Math.sign(directions[index]);
   for(let i=0;i<input.length;i++){const p=input[i],q=input[(i+1)%input.length],dp=distance(p),dq=distance(q);
    if(dp>=0)mask.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);mask.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
   }
  });
  if(mask.length<3)throw Error("İki sınır arasında park alanı bulunamadı.");
  const ring=[...mask,mask[0]].map(projection.inverse);
  const extended=lines.map(([a,b],i)=>{const v=[(b[0]-a[0])/lengths[i],(b[1]-a[1])/lengths[i]],values=xy.map(p=>(p[0]-a[0])*v[0]+(p[1]-a[1])*v[1]);return [Math.min(...values)-10,Math.max(...values)+10].map(t=>projection.inverse([a[0]+t*v[0],a[1]+t*v[1]]));});
  return {geometry:ports.clip(ring,parent,ports.polygon),lines:extended,method:"independent-cuts",label:"Başlangıç ve bitiş sınırları arasındaki park"};
 }
 root.DG_PARK_STAGE_CUT_GEOMETRY=Object.freeze({between,suggest,betweenCuts});
})(window);
