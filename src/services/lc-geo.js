"use strict";
/* DendroGeo · services/lc-geo.js — LULC saf geometri/projeksiyon (Faz 5)
 * landcover.js'ten birebir taşındı: UTM ileri/ters (transverse Mercator
 * serisi), bbox/kesişim yardımcıları, Sutherland-Hodgman kırpma, dışbükey
 * kesişim alanı ve projektif alan hesabı. DOM/ağ bağımlılığı YOKTUR →
 * test/landcover.test.mjs doğrudan birim test eder. */

function dgLcBboxFromGeometry(outer,holes){
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  const visit=ring=>{
    for(const p of (ring||[])){
      const lat=Number(p?.[0]),lon=Number(p?.[1]);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
      minLat=Math.min(minLat,lat);
      maxLat=Math.max(maxLat,lat);
      minLon=Math.min(minLon,lon);
      maxLon=Math.max(maxLon,lon);
    }
  };
  (outer||[]).forEach(visit);
  (holes||[]).forEach(visit);
  if(!(minLat<=maxLat&&minLon<=maxLon)){
    throw new Error("Park polygonu için geçerli koordinat kutusu üretilemedi.");
  }
  return{minLat,maxLat,minLon,maxLon};
}

function dgLcUtmEpsgForLatLon(lat,lon){
  const zone=Math.max(1,Math.min(60,Math.floor((Number(lon)+180)/6)+1));
  return Number(lat)>=0?32600+zone:32700+zone;
}

function dgLcUtmForward(lat,lon,epsg){
  const a=6378137;
  const e2=0.0066943799901413165;
  const ep2=e2/(1-e2);
  const k0=0.9996;
  const la=Number(lat)*Math.PI/180;
  const lo=Number(lon)*Math.PI/180;
  const zone=Number(epsg)%100;
  const south=Number(epsg)>=32700;
  const lon0=((zone-1)*6-180+3)*Math.PI/180;
  const sin=Math.sin(la),cos=Math.cos(la),tan=Math.tan(la);
  const N=a/Math.sqrt(1-e2*sin*sin);
  const T=tan*tan;
  const C=ep2*cos*cos;
  const A=cos*(lo-lon0);
  const M=a*((1-e2/4-3*e2*e2/64-5*e2*e2*e2/256)*la
    -(3*e2/8+3*e2*e2/32+45*e2*e2*e2/1024)*Math.sin(2*la)
    +(15*e2*e2/256+45*e2*e2*e2/1024)*Math.sin(4*la)
    -(35*e2*e2*e2/3072)*Math.sin(6*la));
  const x=k0*N*(A+(1-T+C)*Math.pow(A,3)/6
    +(5-18*T+T*T+72*C-58*ep2)*Math.pow(A,5)/120)+500000;
  let y=k0*(M+N*tan*(A*A/2
    +(5-T+9*C+4*C*C)*Math.pow(A,4)/24
    +(61-58*T+T*T+600*C-330*ep2)*Math.pow(A,6)/720));
  if(south)y+=10000000;
  return{x,y};
}

function dgLcUtmInverse(x,y,epsg){
  const a=6378137;
  const e2=0.0066943799901413165;
  const ep2=e2/(1-e2);
  const k0=0.9996;
  const zone=Number(epsg)%100;
  const south=Number(epsg)>=32700;
  const lon0=((zone-1)*6-180+3)*Math.PI/180;
  let yy=Number(y);
  if(south)yy-=10000000;
  const M=yy/k0;
  const mu=M/(a*(1-e2/4-3*e2*e2/64-5*e2*e2*e2/256));
  const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const J1=3*e1/2-27*Math.pow(e1,3)/32;
  const J2=21*e1*e1/16-55*Math.pow(e1,4)/32;
  const J3=151*Math.pow(e1,3)/96;
  const J4=1097*Math.pow(e1,4)/512;
  const fp=mu+J1*Math.sin(2*mu)+J2*Math.sin(4*mu)+J3*Math.sin(6*mu)+J4*Math.sin(8*mu);
  const sin=Math.sin(fp),cos=Math.cos(fp),tan=Math.tan(fp);
  const C1=ep2*cos*cos;
  const T1=tan*tan;
  const N1=a/Math.sqrt(1-e2*sin*sin);
  const R1=a*(1-e2)/Math.pow(1-e2*sin*sin,1.5);
  const D=(Number(x)-500000)/(N1*k0);
  const lat=fp-(N1*tan/R1)*(D*D/2
    -(5+3*T1+10*C1-4*C1*C1-9*ep2)*Math.pow(D,4)/24
    +(61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*Math.pow(D,6)/720);
  const lon=lon0+(D-(1+2*T1+C1)*Math.pow(D,3)/6
    +(5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*Math.pow(D,5)/120)/cos;
  return{lat:lat*180/Math.PI,lon:lon*180/Math.PI};
}

function dgLcRingBBoxXY(ring){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of (ring||[])){
    minX=Math.min(minX,p.x);
    minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x);
    maxY=Math.max(maxY,p.y);
  }
  return{minX,minY,maxX,maxY};
}

function dgLcBboxOverlap(a,b){
  /* Savunmacı: a, dgLcProjectGeometry'nin atadığı _bbox'tur. Bugünkü çağrı
   * yolunda daima doludur, ama halka başka bir yoldan gelirse a.maxX
   * TypeError fırlatıyordu. Üstüşme yok saymak, analiz çökmesinden iyidir. */
  if(!a||!b)return false;
  return !(a.maxX<=b.minX||a.minX>=b.maxX||a.maxY<=b.minY||a.minY>=b.maxY);
}

function dgLcClipPolygonRect(poly,rect){
  if(!Array.isArray(poly)||poly.length<3)return[];
  let out=poly.slice();

  const clip=(inside,intersect)=>{
    if(!out.length)return;
    const input=out;
    out=[];
    let s=input[input.length-1];
    for(const e of input){
      const ein=inside(e),sin=inside(s);
      if(ein){
        if(!sin)out.push(intersect(s,e));
        out.push(e);
      }else if(sin){
        out.push(intersect(s,e));
      }
      s=e;
    }
  };

  clip(p=>p.x>=rect.minX,(a,b)=>{
    const dx=b.x-a.x||1e-12;
    const t=(rect.minX-a.x)/dx;
    return{x:rect.minX,y:a.y+(b.y-a.y)*t};
  });
  clip(p=>p.x<=rect.maxX,(a,b)=>{
    const dx=b.x-a.x||1e-12;
    const t=(rect.maxX-a.x)/dx;
    return{x:rect.maxX,y:a.y+(b.y-a.y)*t};
  });
  clip(p=>p.y>=rect.minY,(a,b)=>{
    const dy=b.y-a.y||1e-12;
    const t=(rect.minY-a.y)/dy;
    return{x:a.x+(b.x-a.x)*t,y:rect.minY};
  });
  clip(p=>p.y<=rect.maxY,(a,b)=>{
    const dy=b.y-a.y||1e-12;
    const t=(rect.maxY-a.y)/dy;
    return{x:a.x+(b.x-a.x)*t,y:rect.maxY};
  });

  return out;
}

/* Dışbükey kırpma penceresi ile Sutherland-Hodgman.
 * dgLcClipPolygonRect'in genellemesidir: kırpma bölgesi eksen hizalı
 * dikdörtgen olmak zorunda değildir. EPSG:4326 rasterlarda hücrenin dört
 * köşesi analiz UTM'sine projekte edildiğinde hafif yamuk bir dörtgen
 * oluşur; dikdörtgen özel durumu da aynı koddan geçer (testlerle kilitli).
 *
 * clipPoly köşeleri SAAT YÖNÜNÜN TERSİ (CCW) verilmelidir; değilse içeride
 * çevrilir. */
function dgLcEnsureCcw(poly){
  let a=0;
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length];
    a+=p.x*q.y-q.x*p.y;
  }
  return a<0?poly.slice().reverse():poly;
}

function dgLcClipPolygonConvex(poly,clipRaw){
  if(!Array.isArray(poly)||poly.length<3)return[];
  const clip=dgLcEnsureCcw(clipRaw);
  if(clip.length<3)return[];
  let out=poly.slice();
  for(let i=0;i<clip.length&&out.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length];
    // yarı-düzlem: (b-a) x (p-a) >= 0  (CCW kenarın solu)
    const inside=p=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-1e-9;
    const intersect=(p,q)=>{
      const x1=p.x,y1=p.y,x2=q.x,y2=q.y,x3=a.x,y3=a.y,x4=b.x,y4=b.y;
      const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
      if(!den)return {x:q.x,y:q.y};
      const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den;
      return {x:x1+t*(x2-x1),y:y1+t*(y2-y1)};
    };
    const input=out;out=[];
    let prev=input[input.length-1],prevIn=inside(prev);
    for(const cur of input){
      const curIn=inside(cur);
      if(curIn){
        if(!prevIn)out.push(intersect(prev,cur));
        out.push(cur);
      }else if(prevIn){
        out.push(intersect(prev,cur));
      }
      prev=cur;prevIn=curIn;
    }
  }
  return out;
}

/* Park poligonu (delikli) ∩ dışbükey hücre dörtgeni = m² */
/* Dikdörtgen (eksen hizalı) hücre kesişimi — ESA geçişinden önceki sürüm.
 * Üretimde dgLcIntersectionAreaConvex kullanılır; bu fonksiyon testlerde
 * REFERANS gerçekleme olarak korunur (convex ile aynı sonucu üretmeli). */
function dgLcIntersectionArea(outerRings,holeRings,rect){
  let area=0;
  for(const ring of (outerRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,rect))continue;
    area+=dgLcPlanarArea(dgLcClipPolygonRect(ring,rect));
  }
  for(const ring of (holeRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,rect))continue;
    area-=dgLcPlanarArea(dgLcClipPolygonRect(ring,rect));
  }
  return Math.max(0,area);
}

function dgLcIntersectionAreaConvex(outerRings,holeRings,quad){
  let area=0;
  for(const ring of (outerRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,quad._bbox))continue;
    area+=dgLcPlanarArea(dgLcClipPolygonConvex(ring,quad));
  }
  for(const ring of (holeRings||[])){
    if(!dgLcBboxOverlap(ring._bbox,quad._bbox))continue;
    area-=dgLcPlanarArea(dgLcClipPolygonConvex(ring,quad));
  }
  return Math.max(0,area);
}

/* Dört köşeden _bbox türet */
function dgLcQuadBBox(quad){
  return quad.reduce((a,p)=>({
    minX:Math.min(a.minX,p.x),minY:Math.min(a.minY,p.y),
    maxX:Math.max(a.maxX,p.x),maxY:Math.max(a.maxY,p.y),
  }),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
}

function dgLcPlanarArea(poly){
  if(!Array.isArray(poly)||poly.length<3)return 0;
  let s=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    s+=a.x*b.y-b.x*a.y;
  }
  return Math.abs(s)/2;
}

function dgLcProjectGeometry(outer,holes,epsg){
  const projectRing=ring=>{
    const p=(ring||[]).map(q=>{
      const z=dgLcUtmForward(Number(q[0]),Number(q[1]),epsg);
      return{x:z.x,y:z.y};
    });
    p._bbox=dgLcRingBBoxXY(p);
    return p;
  };
  return{
    outer:(outer||[]).map(projectRing).filter(r=>r.length>=3),
    holes:(holes||[]).map(projectRing).filter(r=>r.length>=3)
  };
}

function dgLcProjectedArea(geometry){
  let a=0;
  for(const r of geometry.outer)a+=dgLcPlanarArea(r);
  for(const r of geometry.holes)a-=dgLcPlanarArea(r);
  return Math.max(0,a);
}
