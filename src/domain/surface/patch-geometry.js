"use strict";
/* Saf geometri: patch halkası çıkarımı, görünüm yumuşatma ve nokta-halka testi.
 * Raster sınıfını, hücre alanını veya kabul edilmiş yüzey sonucunu değiştirmez. */
(function(root){
function dgSurfacePatchRings(cells){
  const key=c=>c.row+":"+c.col;
  const set=new Set(cells.map(key));
  const byKey=new Map(cells.map(c=>[key(c),c]));
  /* köşe(r,c) → lat/lon: köşeye bitişik herhangi bir hücrenin quadWgs'inden */
  const corner=(r,c)=>{
    const src=byKey.get(r+":"+c)||byKey.get((r-1)+":"+c)||byKey.get(r+":"+ (c-1))||byKey.get((r-1)+":"+(c-1));
    if(!src)return null;
    // hücre (sr,sc) quadWgs: [0]=(lon0,latBot) [1]=(lon1,latBot) [2]=(lon1,latTop) [3]=(lon0,latTop)
    const dr=r-src.row,dc=c-src.col;
    if(dr===0&&dc===0)return src.quadWgs[3];
    if(dr===0&&dc===1)return src.quadWgs[2];
    if(dr===1&&dc===1)return src.quadWgs[1];
    if(dr===1&&dc===0)return src.quadWgs[0];
    return null;
  };
  const edges=[];   // [ [r,c], [r2,c2] ] yönlü köşe çiftleri
  for(const c of cells){
    const r=c.row,cc=c.col;
    if(!set.has((r-1)+":"+cc))edges.push([[r,cc],[r,cc+1]]);       // kuzey
    if(!set.has(r+":"+(cc+1)))edges.push([[r,cc+1],[r+1,cc+1]]);    // doğu
    if(!set.has((r+1)+":"+cc))edges.push([[r+1,cc+1],[r+1,cc]]);    // güney
    if(!set.has(r+":"+(cc-1)))edges.push([[r+1,cc],[r,cc]]);        // batı
  }
  const startMap=new Map();
  for(const e of edges){
    const k=e[0][0]+","+e[0][1];
    if(!startMap.has(k))startMap.set(k,[]);
    startMap.get(k).push(e);
  }
  const used=new Set();
  const ringsGrid=[];
  for(let i=0;i<edges.length;i++){
    if(used.has(i))continue;
    const ring=[edges[i][0]];
    used.add(i);
    let cur=edges[i][1];
    let guard=0;
    while(guard++<edges.length+1){
      ring.push(cur);
      const k=cur[0]+","+cur[1];
      const opts=startMap.get(k)||[];
      let next=null,nextIdx=-1;
      for(const o of opts){
        const idx=edges.indexOf(o);
        if(!used.has(idx)){next=o;nextIdx=idx;break;}
      }
      if(nextIdx<0)break;
      used.add(nextIdx);
      cur=next[1];
      if(cur[0]===ring[0][0]&&cur[1]===ring[0][1])break;
    }
    /* kapanışta başlangıç köşesi çift yazılmışsa tekilleştir —
     * sonst sadeleştirme adımı köşeyi yutuyor ve halka alanı küçülüyordu */
    if(ring.length>1&&ring[ring.length-1][0]===ring[0][0]&&ring[ring.length-1][1]===ring[0][1])ring.pop();
    if(ring.length>=4)ringsGrid.push(ring);
  }
  /* grid köşelerinden lat/lon halkalarına */
  const rings=[];
  for(const rg of ringsGrid){
    const pts=[];
    for(const [r,c] of rg){
      const w=corner(r,c);
      if(!w)continue;
      const last=pts[pts.length-1];
      if(last&&last[0]===w[1]&&last[1]===w[0])continue;   // tekrar köşeyi at
      pts.push([w[1],w[0]]);                               // [lat,lon]
    }
    if(pts.length>=3){
      // doğrusal ardışık noktaları sadeleştir
      const simp=[];
      for(let i=0;i<pts.length;i++){
        const a=pts[(i-1+pts.length)%pts.length],b=pts[i],c2=pts[(i+1)%pts.length];
        const cross=(b[0]-a[0])*(c2[1]-b[1])-(b[1]-a[1])*(c2[0]-b[0]);
        /* doğrusal (collinear) ara köşeleri at: yalnızca yön değişimi kalan
         * köşeler korunur; sonst kare halka 12 noktayla gereksiz şişer */
        if(Math.abs(cross)>1e-12)simp.push(b);
      }
      if(simp.length>=3)rings.push(simp);
    }
  }
  if(!rings.length)return[];
  /* dış halka / delik ayrımı: işaretli alan (lon,lat düzleminde) */
  const signed=r=>{
    let a=0;
    for(let i=0;i<r.length;i++){
      const p=r[i],q=r[(i+1)%r.length];
      a+=p[1]*q[0]-q[1]*p[0];
    }
    return a/2;
  };
  const withSign=rings.map(r=>({pts:r,a:signed(r)}));
  withSign.sort((x,y)=>Math.abs(y.a)-Math.abs(x.a));
  const outer=withSign[0];
  const holes=withSign.slice(1).filter(h=>Math.sign(h.a)!==Math.sign(outer.a));
  return [outer.pts,...holes.map(h=>h.pts)];
}

/* Halka alanı (derece düzleminde shoelace) ve merkez — alan geri ölçekleme için. */
function dgSurfaceRingArea(ring){
  let a=0;
  for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length];
    a+=p[0]*q[1]-q[0]*p[1];
  }
  return a/2;
}

function dgSurfaceRingCentroid(ring){
  let x=0,y=0;
  for(const p of ring){x+=p[0];y+=p[1];}
  return [x/ring.length,y/ring.length];
}

/* Chaikin yumuşatma: kapalı halkada her kenarı 25/75 noktalarıyla değiştirir.
 * YALNIZCA GÖRSEL katman; rapor sayılarına dokunmaz. */
function dgSurfaceSmoothRing(ring,iters){
  let pts=ring.slice();
  const n=iters==null?1:iters;
  for(let k=0;k<n&&pts.length>=4;k++){
    const out=[];
    for(let i=0;i<pts.length;i++){
      const p=pts[i],q=pts[(i+1)%pts.length];
      out.push([0.75*p[0]+0.25*q[0],0.75*p[1]+0.25*q[1]]);
      out.push([0.25*p[0]+0.75*q[0],0.25*p[1]+0.75*q[1]]);
    }
    pts=out;
  }
  return pts;
}

/* Nokta halka içinde mi (ışın yöntemi, [lat,lon] halkaları). */
function dgSurfacePointInRing(lat,lon,ring){
  let ic=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const yi=ring[i][0],xi=ring[i][1],yj=ring[j][0],xj=ring[j][1];
    if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)ic=!ic;
  }
  return ic;
}

/* Nokta dış halka içinde ve deliklerde değil mi? */
function dgSurfacePointInRings(lat,lon,rings){
  if(!rings||!rings.length)return false;
  if(!dgSurfacePointInRing(lat,lon,rings[0]))return false;
  for(let i=1;i<rings.length;i++){
    if(dgSurfacePointInRing(lat,lon,rings[i]))return false;
  }
  return true;
}

root.DG_SURFACE_PATCH_GEOMETRY=Object.freeze({patchRings:dgSurfacePatchRings,ringArea:dgSurfaceRingArea,ringCentroid:dgSurfaceRingCentroid,smoothRing:dgSurfaceSmoothRing,pointInRing:dgSurfacePointInRing,pointInRings:dgSurfacePointInRings});
})(typeof window!=="undefined"?window:globalThis);
