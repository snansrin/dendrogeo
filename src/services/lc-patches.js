"use strict";
/* DendroGeo · services/lc-patches.js — yeşil alan nesne/patch çıkarımı (Faz 5)
 * landcover.js'ten birebir taşındı: hücre kümelerinden patch tespiti,
 * ring üretimi, alan/merkez hesabı, yumuşatma ve isGreen/hasGreen
 * sorguları (grid-engine'in yeşil-alan kapısı bunları kullanır). */

/* ---------- Nesne tanımlama: bağlantılı bileşenler ----------
 * Aynı sınıfa ait bitişik (4-yön) 10 m hücreleri tek bir "nesne" sayılır:
 * göl, çayır bloğu, yapılı alan parçası... Her bileşen için alan ve
 * alan-ağırlıklı merkez üretilir. Park ölçeğinde "kaç su kütlesi var,
 * en büyük yeşil blok nerede?" sorularının cevabıdır. */
function dgLcDetectPatches(cells,minHa){
  const threshold=(minHa==null?0.05:minHa)*10000;
  const key=c=>c.epsg+":"+c.row+":"+c.col;
  const grid=new Map();
  for(const c of cells)grid.set(key(c),c);
  const seen=new Set();
  const patches=[];
  for(const c of cells){
    const k0=key(c);
    if(seen.has(k0))continue;
    seen.add(k0);
    const stack=[c];
    const comp=[c];
    while(stack.length){
      const cur=stack.pop();
      const nb=[[1,0],[-1,0],[0,1],[0,-1]];
      for(const [dr,dc] of nb){
        const nk=cur.epsg+":"+(cur.row+dr)+":"+(cur.col+dc);
        const n=grid.get(nk);
        if(n&&!seen.has(nk)&&n.classKey===cur.classKey){
          seen.add(nk);
          stack.push(n);
          comp.push(n);
        }
      }
    }
    const area=comp.reduce((t,x)=>t+(x.areaM2||0),0);
    if(area<threshold)continue;
    let wl=0,wo=0;
    for(const x of comp){wl+=x.center.lat*(x.areaM2||0);wo+=x.center.lon*(x.areaM2||0);}
    /* Görsel katman için vektör halkalar: kare kare değil, yumuşak çizim.
     * Rapor sayılarına dokunmaz (alan hücre kesişiminden gelir). */
    let rings=[],ringsRaw=[];
    try{
      ringsRaw=dgLcPatchRings(comp);
      /* Yumuşatma köşeleri kestiği için halkayı bir miktar içe büker;
       * komşu nesnelerin sınırları birbirinden uzaklaşmış görünüyordu
       * (kullanıcı geri bildirimi 2026-09-20). Çözüm: TEK tur Chaikin +
       * alan geri ölçekleme — yumuşak çizgi, gerçek boyut, bitişik sınırlar
       * tekrar birbirine değer. */
      rings=ringsRaw.map(r=>{
        const sm=dgLcSmoothRing(r,1);
        const a0=Math.abs(dgLcRingArea(r)),a1=Math.abs(dgLcRingArea(sm));
        if(!(a0>0)||!(a1>0))return sm;
        const f=Math.sqrt(a0/a1);
        if(!Number.isFinite(f)||f<=1||f>1.5)return sm;
        const c=dgLcRingCentroid(sm);
        return sm.map(pt=>[c[0]+(pt[0]-c[0])*f,c[1]+(pt[1]-c[1])*f]);
      });
    }catch(err){
      console.warn("DENDROGEO · nesne halkası kurulamadı, atlandı:",err);
    }
    patches.push({
      classKey:comp[0].classKey,
      areaM2:area,
      cells:comp.length,
      centroid:{lat:wl/area,lon:wo/area},
      rings,
      ringsRaw
    });
  }
  patches.sort((a,b)=>b.areaM2-a.areaM2);
  return patches;
}

/* ---------- Piksel yığınını vektör halkalara çevir ----------
 * Kare kare bant çizimi yerine: bir nesnenin (bağlantılı bileşen) hücre
 * kümesinden SINIR İZİ çıkarılır → dış halka + delikler → Chaikin ile
 * yumuşatılır. Sonuç haritada "gerçek çizim" gibi organik bir poligon
 * olarak görünür. Sayısal hesaplar DEĞİŞMEZ (hâlâ tam hücre kesişimi);
 * bu yalnızca görsel katman.
 *
 * Yöntem:
 *  · her hücrenin 4 komşusuna bakılır; komşu nesneye ait değilse o kenar
 *    SINIR kenarıdır ve bölgeyi tutarlı yönde dolaşan yönlü doğru parçası
 *    olarak eklenir (paylaşılan kenarlar zaten hiç üretilmez)
 *  · köşe noktaları zincirlenerek kapalı halkalar kurulur
 *  · halkalar lat/lon'a çevrilir; işaretli alanla dış halka / delik ayrımı
 *    yapılır, delikler dış halkanın içine yuvalanır (Leaflet hole sözdizimi)
 *  · Chaikin (2 tur) köşeleri yumuşatır */
function dgLcPatchRings(cells){
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
function dgLcRingArea(ring){
  let a=0;
  for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length];
    a+=p[0]*q[1]-q[0]*p[1];
  }
  return a/2;
}

function dgLcRingCentroid(ring){
  let x=0,y=0;
  for(const p of ring){x+=p[0];y+=p[1];}
  return [x/ring.length,y/ring.length];
}

/* Chaikin yumuşatma: kapalı halkada her kenarı 25/75 noktalarıyla değiştirir.
 * YALNIZCA GÖRSEL katman; rapor sayılarına dokunmaz. */
function dgLcSmoothRing(ring,iters){
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
function dgLcPointInRing(lat,lon,ring){
  let ic=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const yi=ring[i][0],xi=ring[i][1],yj=ring[j][0],xj=ring[j][1];
    if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)ic=!ic;
  }
  return ic;
}

/* Nokta dış halka içinde ve deliklerde değil mi? */
function dgLcPointInRings(lat,lon,rings){
  if(!rings||!rings.length)return false;
  if(!dgLcPointInRing(lat,lon,rings[0]))return false;
  for(let i=1;i<rings.length;i++){
    if(dgLcPointInRing(lat,lon,rings[i]))return false;
  }
  return true;
}

/* Bir koordinat LULC analizine göre YEŞİL nesne içinde mi?
 * Grid sistemi bunu kullanır: ölçüm hücreleri yalnız yeşil alanda kurulur.
 * Ham (yumuşatılmamış) halkalar kullanılır — hassasiyet için. */
function dgLcIsGreen(lat,lon){
  const last=DG_LC_LAST;
  if(!last||!last.patches)return false;
  for(const pt of last.patches){
    if((pt.classKey||pt.group)!=="green")continue;
    if(dgLcPointInRings(lat,lon,pt.ringsRaw||pt.rings))return true;
  }
  return false;
}

function dgLcHasGreen(){
  const last=DG_LC_LAST;
  return !!(last&&last.patches&&last.patches.some(p=>(p.classKey||p.group)==="green"));
}
