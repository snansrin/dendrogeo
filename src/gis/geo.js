/* DendroGeo GIS tools — independent read-only measurement mathematics.
 * NOT part of ESA/OSM/Sentinel class engine. WGS84, decimal coordinates;
 * distances and areas are APPROXIMATE (sphere R=6371008.8m). */
(function(root){
"use strict";
const R=6371008.8, RAD=Math.PI/180;
const finite=n=>typeof n==="number"&&Number.isFinite(n);
function point(v){
 const lat=Number(v?.lat??v?.[0]),lng=Number(v?.lng??v?.lon??v?.[1]);
 if(!finite(lat)||!finite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error("Koordinat geçersiz (EPSG:4326).");
 return {lat,lng};
}
function radians(v){return v*RAD;}
function distance(a,b){
 a=point(a);b=point(b);
 const p=radians(a.lat),q=radians(b.lat),dl=radians(b.lng-a.lng),dp=q-p;
 const h=Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;
 return 2*R*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}
function pathLength(points,closed=false){
 if(!Array.isArray(points)||points.length<2)return 0;
 const p=points.map(point);let d=0;
 for(let i=1;i<p.length;i++)d+=distance(p[i-1],p[i]);
 if(closed&&p.length>2)d+=distance(p[p.length-1],p[0]);
 return d;
}
/* Spherical excess using a longitude-wrap-resistant Chamberlain-Duquette sum.
 * Positive CCW/negative CW orientations are normalized to unsigned minimal area.
 * Not a cadastral ellipsoidal or accepted surface analysis measurement. */
function polygonArea(points){
 if(!Array.isArray(points)||points.length<3)return 0;
 const p=points.map(point),sum=p.reduce((acc,a,i)=>{
  const b=p[(i+1)%p.length];
  let d=radians(b.lng-a.lng);
  if(d>Math.PI)d-=2*Math.PI;
  if(d< -Math.PI)d+=2*Math.PI;
  return acc+d*(2+Math.sin(radians(a.lat))+Math.sin(radians(b.lat)));
 },0);
 const full=4*Math.PI*R*R,area=Math.abs(sum*R*R/2);
 return Math.min(area,Math.max(0,full-area));
}
function bearing(a,b){
 a=point(a);b=point(b);
 const p=radians(a.lat),q=radians(b.lat),dl=radians(b.lng-a.lng);
 const y=Math.sin(dl)*Math.cos(q),x=Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(dl);
 return (Math.atan2(y,x)/RAD+360)%360;
}
function dms(value,isLatitude=true){
 if(!finite(Number(value)))throw Error("Koordinat geçersiz.");
 const v=Number(value),dir=isLatitude?(v<0?"G":"K"):(v<0?"B":"D");
 let d=Math.floor(Math.abs(v)),m=Math.floor((Math.abs(v)-d)*60),s=Math.round((Math.abs(v)*3600-d*3600-m*60)*10)/10;
 if(s>=60){s-=60;m++}if(m>=60){m-=60;d++}
 return d+"° "+m+"' "+s.toFixed(1)+'" '+dir;
}
/* Standard WGS84 Transverse Mercator UTM, valid only latitude -80..84. */
function utm(value){
 const p=point(value),lat=p.lat,lon=p.lng;
 if(lat< -80||lat>84)throw Error("UTM -80° ile +84° enlemleri arasında geçerlidir.");
 let zone=Math.floor((lon+180)/6)+1;zone=Math.max(1,Math.min(60,zone));
 if(lat>=56&&lat<64&&lon>=3&&lon<12)zone=32;
 if(lat>=72&&lat<84){if(lon>=0&&lon<9)zone=31;else if(lon<21&&lon>=9)zone=33;else if(lon<33&&lon>=21)zone=35;else if(lon<42&&lon>=33)zone=37;}
 const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=.9996;
 const phi=radians(lat),lam=radians(lon-(zone*6-183)),N=a/Math.sqrt(1-e2*Math.sin(phi)**2);
 const T=Math.tan(phi)**2,C=ep2*Math.cos(phi)**2,A=Math.cos(phi)*lam;
 const M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi
 -(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*phi)
 +(15*e2**2/256+45*e2**3/1024)*Math.sin(4*phi)
 -(35*e2**3/3072)*Math.sin(6*phi));
 const E=k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T**2+72*C-58*ep2)*A**5/120)+500000;
 const Y=k0*(M+N*Math.tan(phi)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720));
 const north=lat>=0;
 return {zone,hemisphere:north?"N":"S",epsg:(north?32600:32700)+zone,easting:E,northing:north?Y:Y+10000000};
}
function ringContains(p,ring){
 p=point(p);let yes=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=point(ring[i]),b=point(ring[j]);
  if(((a.lat>p.lat)!==(b.lat>p.lat))&&(p.lng<(b.lng-a.lng)*(p.lat-a.lat)/(b.lat-a.lat)+a.lng))yes=!yes;
 }return yes;
}
function fmtDistance(m){return m>=1000?(m/1000).toLocaleString("tr-TR",{maximumFractionDigits:3})+" km":m.toLocaleString("tr-TR",{maximumFractionDigits:2})+" m";}
function fmtArea(a){return a>=10000?(a/10000).toLocaleString("tr-TR",{maximumFractionDigits:4})+" ha":a.toLocaleString("tr-TR",{maximumFractionDigits:1})+" m²";}
function geojson(points,kind,name="GIS ölçümü"){
 const p=points.map(point),polygon=kind==="area"&&p.length>=3;
 const geometry=polygon?{type:"Polygon",coordinates:[[...p.map(x=>[x.lng,x.lat]),[p[0].lng,p[0].lat]]]}:{type:"LineString",coordinates:p.map(x=>[x.lng,x.lat])};
 return {type:"FeatureCollection",name:"DendroGeo GIS ölçüm katmanı",features:[{type:"Feature",properties:{name,source:"user-measurement",crs:"EPSG:4326",precision:"approximate",length_m:pathLength(p,polygon),area_m2:polygon?polygonArea(p):null},geometry}]};
}
function kml(featureCollection){
 const feature=featureCollection.features[0],f=feature.geometry,polygon=f.type==="Polygon",pts=polygon?f.coordinates[0]:f.coordinates;
 const coords=pts.map(([lng,lat])=>lng+","+lat+",0").join(" ");
 const tag=polygon?"<Polygon><outerBoundaryIs><LinearRing><coordinates>"+coords+"</coordinates></LinearRing></outerBoundaryIs></Polygon>":"<LineString><tessellate>1</tessellate><coordinates>"+coords+"</coordinates></LineString>";
 return '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>DendroGeo GIS</name><Placemark><name>Ölçüm</name>'+tag+'</Placemark></Document></kml>';
}
root.DG_GIS_GEO=Object.freeze({R,point,distance,pathLength,polygonArea,bearing,dms,utm,ringContains,fmtDistance,fmtArea,geojson,kml});
})(typeof window!=="undefined"?window:globalThis);
