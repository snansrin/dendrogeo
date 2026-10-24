"use strict";
/* Stage-only cut paths. Never edits the parent perimeter or stored stage geometry. */
(function(root){
 function frame(parent){
  const points=parent?.outer?.flat();if(!points?.length)throw Error("Ana parkın sınırı hazır değil.");
  const lat=points.reduce((n,p)=>n+p[0],0)/points.length,lon=points.reduce((n,p)=>n+p[1],0)/points.length,m=6378137*Math.PI/180,s=Math.max(.001,Math.cos(lat*Math.PI/180));
  return {xy:p=>[(p[1]-lon)*s*m,(p[0]-lat)*m],ll:p=>[p[1]/m+lat,p[0]/(s*m)+lon]};
 }
 function between(parent,cuts,{polygon,clip}){
  if(!Array.isArray(cuts)||cuts.length!==2||!cuts.every(line=>Array.isArray(line)&&line.length>=2&&line.length<=40&&line.every(p=>p?.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180)))throw Error("Başlangıç ve bitiş için 2–40 nokta yerleştirin.");
  const f=frame(parent),paths=cuts.map(line=>line.map(f.xy)),a=paths[0][0],b=paths[0].at(-1),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(length<2)throw Error("Sınırın ilk ve son noktası en az 2 metre ayrı olmalı.");
  const v=[(b[0]-a[0])/length,(b[1]-a[1])/length],n=[-v[1],v[0]],uv=p=>[p[0]*v[0]+p[1]*v[1],p[0]*n[0]+p[1]*n[1]],ll=p=>f.ll([p[0]*v[0]+p[1]*n[0],p[0]*v[1]+p[1]*n[1]]);
  const lines=paths.map(line=>{let points=line.map(uv);if(points.at(-1)[0]<points[0][0])points.reverse();for(let i=1;i<points.length;i++)if(points[i][0]-points[i-1][0]<.25||Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])<2)throw Error("Noktaları sınır boyunca sırayla ve en az 2 metre arayla yerleştirin; hat geriye katlanmamalı.");return points;});
  const all=[...parent.outer.flat().map(p=>uv(f.xy(p))),...lines.flat()],low=Math.min(...all.map(p=>p[0]))-10,high=Math.max(...all.map(p=>p[0]))+10;
  const extended=lines.map(line=>{const a=line[0],b=line[1],c=line.at(-2),d=line.at(-1);return [[low,a[1]+(low-a[0])*(b[1]-a[1])/(b[0]-a[0])],...line,[high,d[1]+(high-d[0])*(d[1]-c[1])/(d[0]-c[0])]];});
  const ring=[...extended[0],...extended[1].slice().reverse()].map(ll);ring.push([...ring[0]]);
  const geometry=root.DG_PARK_STAGE_GEOMETRY.validateRing(ring)?clip(ring,parent,polygon):crossingBand(parent,extended,ll,polygon);
  return {geometry,lines:extended.map(line=>line.map(ll)),cuts:cuts.map(line=>line.map(p=>[...p])),method:"boundary-paths",label:"Başlangıç ve bitiş hatları arasındaki etap"};
 }
 function crossingBand(parent,lines,ll,polygon){
  const value=(line,u)=>{let i=1;while(i<line.length-1&&line[i][0]<u)i++;const a=line[i-1],b=line[i];return a[1]+(u-a[0])*(b[1]-a[1])/(b[0]-a[0]);};
  const inside=p=>{const contains=ring=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[0]>p[0])!==(b[0]>p[0])&&p[1]<(b[1]-a[1])*(p[0]-a[0])/(b[0]-a[0])+a[1])yes=!yes;}return yes;};return parent.outer.some(contains)&&!(parent.inner||[]).some(contains);};
  const breaks=[...new Set(lines.flat().map(p=>p[0]))].sort((a,b)=>a-b),crossings=[];
  const delta=u=>value(lines[0],u)-value(lines[1],u);
  for(let i=1;i<breaks.length;i++){
   const a=breaks[i-1],b=breaks[i],da=delta(a),db=delta(b);
   if(Math.abs(da)<1e-8&&inside(ll([a,value(lines[0],a)]))||Math.abs(db)<1e-8&&inside(ll([b,value(lines[0],b)]))||Math.abs(da)<1e-8&&Math.abs(db)<1e-8&&inside(ll([(a+b)/2,value(lines[0],(a+b)/2)])))throw Error("Başlangıç ve bitiş hatları park içinde kesişiyor. Numaralı noktaları düzeltin.");
   if(da*db<0){const u=a+(b-a)*da/(da-db);if(inside(ll([u,value(lines[0],u)])))throw Error("Başlangıç ve bitiş hatları park içinde kesişiyor. Numaralı noktaları düzeltin.");crossings.push(u);}
  }
  // Keep one consistent ordering; an outside crossing never selects a second,
  // inverted wedge on the other side of the park.
  const probe=lines.reduce((n,line)=>n+(line[1][0]+line.at(-2)[0])/4,0),order=Math.sign(delta(probe));
  if(!order)throw Error("Başlangıç ve bitiş hatlarını birbirinden ayırın.");
  const knots=[...new Set([...breaks,...crossings])].sort((a,b)=>a-b),masks=[],flip=ring=>ring.map(p=>[p[1],p[0]]);
  for(let i=1;i<knots.length;i++){
   const a=knots[i-1],b=knots[i];if(delta((a+b)/2)*order<=0)continue;
   const at=u=>{const x=value(lines[0],u),y=value(lines[1],u);return Math.abs(x-y)<1e-8?[(x+y)/2,(x+y)/2]:[x,y];},[a0,a1]=at(a),[b0,b1]=at(b);
   const ring=[[a,a0],[b,b0],[b,b1],[a,a1],[a,a0]].map(ll);masks.push([flip(ring)]);
  }
  if(!masks.length)throw Error("İki sınır arasında park alanı bulunamadı.");
  let park=polygon.union(...parent.outer.map(r=>[flip(r)]));if(parent.inner?.length)park=polygon.difference(park,...parent.inner.map(r=>[flip(r)]));
  const result=polygon.intersection(polygon.union(...masks),park);if(!result.length)throw Error("Etap park alanıyla kesişmiyor.");
  const geometry={outer:[],inner:[]};for(const part of result){geometry.outer.push(flip(part[0]));for(const hole of part.slice(1))geometry.inner.push(flip(hole));}return geometry;
 }
 function recover(parent,stage){
  const f=frame(parent),edges=[...parent.outer,...(parent.inner||[])].flatMap(r=>r.slice(1).map((p,i)=>[f.xy(r[i]),f.xy(p)]));
  const on=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;if(!l)return Math.hypot(p[0]-a[0],p[1]-a[1])<.02;const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l;return t>=-1e-8&&t<=1+1e-8&&Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<.02;};
  const paths=[];
  for(const ring of [...(stage?.outer||[]),...(stage?.inner||[])]){
   const flags=ring.slice(1).map((p,i)=>{const a=f.xy(ring[i]),b=f.xy(p);return !edges.some(([c,d])=>on(a,c,d)&&on(b,c,d));});
   const seam=flags.indexOf(false);if(seam<0){if(flags.some(Boolean))return null;continue;}
   let path=[];for(let k=1;k<=flags.length;k++){const i=(seam+k)%flags.length;if(flags[i]){if(!path.length)path.push([...ring[i]]);path.push([...ring[i+1]]);}else if(path.length){paths.push(path);path=[];}}
   if(path.length)paths.push(path);
  }
  return paths.length===2&&paths.every(p=>p.length>=2&&p.length<=40)?paths:null;
 }
 root.DG_PARK_STAGE_BOUNDARY_PATHS=Object.freeze({between,recover});
})(window);
