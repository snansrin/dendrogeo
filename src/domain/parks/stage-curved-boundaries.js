"use strict";
/* General simple cap paths; projection backtracking is not a geometry error. */
(function(root){
 function between(parent,cuts,{polygon}){
  const allLL=[...parent.outer.flat(),...cuts.flat()],lat=allLL.reduce((s,p)=>s+p[0],0)/allLL.length,lon=allLL.reduce((s,p)=>s+p[1],0)/allLL.length,m=6378137*Math.PI/180,scale=Math.max(.001,Math.cos(lat*Math.PI/180));
  const xy=p=>[(p[1]-lon)*scale*m,(p[0]-lat)*m],ll=p=>[p[1]/m+lat,p[0]/(scale*m)+lon],paths=cuts.map(line=>line.map(xy));
  const contains=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
  const inMulti=(p,mp)=>mp.some(part=>contains(p,part[0])&&!part.slice(1).some(r=>contains(p,r)));
  let park=polygon.union(...parent.outer.map(r=>[r.map(xy)]));if(parent.inner?.length)park=polygon.difference(park,...parent.inner.map(r=>[r.map(xy)]));
  const points=[...parent.outer.flat().map(xy),...paths.flat()],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),margin=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),10)*.1+10;
  const left=Math.min(...xs)-margin,right=Math.max(...xs)+margin,bottom=Math.min(...ys)-margin,top=Math.max(...ys)+margin,w=right-left,h=top-bottom,perimeter=2*(w+h),box=[[left,bottom],[right,bottom],[right,top],[left,top],[left,bottom]];
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function intersection(a,b,c,d){const dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;
   if(Math.abs(den)<1e-10){if(Math.abs(cross(a,b,c))>1e-7)return null;for(const p of [a,b,c,d])if(p[0]>=Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))-1e-7&&p[0]<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))+1e-7&&p[1]>=Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))-1e-7&&p[1]<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))+1e-7)return p;return null;}
   const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;return t>=-1e-10&&t<=1+1e-10&&u>=-1e-10&&u<=1+1e-10?[a[0]+t*dx,a[1]+t*dy]:null;
  }
  function selfCross(line,insideOnly){for(let i=1;i<line.length;i++)for(let j=i+2;j<line.length;j++){const p=intersection(line[i-1],line[i],line[j-1],line[j]);if(p&&(!insideOnly||inMulti(p,park)))return true;}return false;}
  for(const line of paths){for(let i=1;i<line.length;i++)if(Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1])<.01)throw Error("Aynı yere iki nokta koymayın; üst üste gelen noktayı geri alın.");if(selfCross(line,false))throw Error("Sınır hattı kendi üzerinden geçiyor. Kesişen numaralı noktayı düzeltin.");}
  function extend(a,b){const dx=a[0]-b[0],dy=a[1]-b[1],ts=[];if(dx>0)ts.push((right-a[0])/dx);if(dx<0)ts.push((left-a[0])/dx);if(dy>0)ts.push((top-a[1])/dy);if(dy<0)ts.push((bottom-a[1])/dy);const t=Math.min(...ts.filter(n=>n>=0));return[a[0]+t*dx,a[1]+t*dy];}
  const extended=paths.map(line=>[extend(line[0],line[1]),...line,extend(line.at(-1),line.at(-2))]);
  for(const line of extended)if(selfCross(line,true))throw Error("Hattın uç uzantısı park içinde hattı kesiyor. İlk veya son noktayı park kenarına yaklaştırın.");
  for(let i=1;i<extended[0].length;i++)for(let j=1;j<extended[1].length;j++){const p=intersection(extended[0][i-1],extended[0][i],extended[1][j-1],extended[1][j]);if(p&&inMulti(p,park))throw Error("Başlangıç ve bitiş hatları park içinde kesişiyor. Kesişen noktayı düzeltin.");}
  const position=p=>Math.abs(p[1]-bottom)<1e-6?p[0]-left:Math.abs(p[0]-right)<1e-6?w+p[1]-bottom:Math.abs(p[1]-top)<1e-6?w+h+right-p[0]:2*w+h+top-p[1];
  function side(line,other){
   const from=position(line.at(-1)),to=position(line[0]),distance=(to-from+perimeter)%perimeter,route=box.slice(0,-1).map((p,i)=>({p,t:([0,w,w+h,2*w+h][i]-from+perimeter)%perimeter})).filter(p=>p.t>1e-7&&p.t<distance-1e-7).sort((a,b)=>a.t-b.t).map(p=>p.p);
   const ring=[...line,...route,line[0]],first=polygon.intersection(polygon.union([ring]),[box]),second=polygon.difference([box],first);
   const probes=other.flatMap((p,i)=>i?[[...p],[(p[0]+other[i-1][0])/2,(p[1]+other[i-1][1])/2]]:[[...p]]),inside=probes.filter(p=>inMulti(p,park)),sample=inside.length?inside:probes;
   const choices=sample.map(p=>inMulti(p,first)?0:inMulti(p,second)?1:-1).filter(n=>n>=0);if(!choices.length||inside.length&&choices.some(n=>n!==choices[0]))throw Error("Hat uçlarının ayırdığı taraf belirsiz. Uçları parkın iki kenarına yaklaştırın.");
   return choices[Math.floor(choices.length/2)]===0?first:second;
  }
  const result=polygon.intersection(park,side(extended[0],paths[1]),side(extended[1],paths[0]));if(!result.length)throw Error("İki hat arasında park alanı bulunamadı.");
  const geometry={outer:[],inner:[]};for(const part of result){geometry.outer.push(part[0].map(ll));for(const r of part.slice(1))geometry.inner.push(r.map(ll));}
  return{geometry,lines:extended.map(line=>line.map(ll)),cuts:cuts.map(line=>line.map(p=>[...p])),method:"curved-boundaries",label:"Başlangıç ve bitiş hatları arasındaki etap"};
 }
 root.DG_PARK_STAGE_CURVED_BOUNDARIES=Object.freeze({between});
})(window);
