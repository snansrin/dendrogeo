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
  const patches=[];
  for(const comp of window.DG_SURFACE_PATCH_COMPONENTS.groupCells(cells)){
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
function dgLcPatchRings(cells){return window.DG_SURFACE_PATCH_GEOMETRY.patchRings(cells);}
function dgLcRingArea(ring){return window.DG_SURFACE_PATCH_GEOMETRY.ringArea(ring);}
function dgLcRingCentroid(ring){return window.DG_SURFACE_PATCH_GEOMETRY.ringCentroid(ring);}
function dgLcSmoothRing(ring,iters){return window.DG_SURFACE_PATCH_GEOMETRY.smoothRing(ring,iters);}
function dgLcPointInRing(lat,lon,ring){return window.DG_SURFACE_PATCH_GEOMETRY.pointInRing(lat,lon,ring);}
function dgLcPointInRings(lat,lon,rings){return window.DG_SURFACE_PATCH_GEOMETRY.pointInRings(lat,lon,rings);}

/* Bir koordinat LULC analizine göre YEŞİL nesne içinde mi?
 * Grid sistemi bunu kullanır: ölçüm hücreleri yalnız yeşil alanda kurulur.
 * Ham (yumuşatılmamış) halkalar kullanılır — hassasiyet için. */
function dgLcIsGreen(lat,lon){
  const last=DG_LC_LAST;
  if(!last||!last.patches)return false;
  return window.DG_SURFACE_GREEN_PATCH_QUERY.isPointInGreenPatch(lat,lon,last.patches,dgLcPointInRings);
}

function dgLcHasGreen(){
  const last=DG_LC_LAST;
  return !!(last&&window.DG_SURFACE_GREEN_PATCH_QUERY.hasGreenPatch(last.patches));
}
