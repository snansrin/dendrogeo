/* Canvas bounds, sizing, and projection inputs for park PNG export. */
(function(root){
 "use strict";
 function compute({outer,holes,project}){
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  const ext=(lat,lon)=>{
   minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);
   minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);
  };
  (outer||[]).forEach(r=>(r||[]).forEach(p=>ext(p[0],p[1])));
  (holes||[]).forEach(r=>(r||[]).forEach(p=>ext(p[0],p[1])));
  if(!(minLat<=maxLat&&minLon<=maxLon))return null;
  const bufLat=15/110540;
  const bufLon=15/(111320*Math.cos(((minLat+maxLat)/2)*Math.PI/180));
  minLat-=bufLat;maxLat+=bufLat;minLon-=bufLon;maxLon+=bufLon;
  const lat0=(minLat+maxLat)/2;
  const MX=111320*Math.cos(lat0*Math.PI/180),MY=110540;
  const wM=Math.max(1,(maxLon-minLon)*MX),hM=Math.max(1,(maxLat-minLat)*MY);
  const PAD=70,LEGH=132;
  const scale=Math.min((1600-2*PAD)/wM,(1150-2*PAD)/hM);
  const W=Math.max(960,Math.round(wM*scale+2*PAD));
  const Htop=PAD+46;
  const H=Math.round(Htop+hM*scale+PAD+LEGH);
  const projector=project({minLat,maxLat,minLon,maxLon,width:W,heightTop:Htop,scale});
  return{minLat,maxLat,minLon,maxLon,MX,MY,wM,hM,PAD,LEGH,scale,W,Htop,H,projector};
 }
 root.DG_PARK_EXPORT_LAYOUT=Object.freeze({compute});
})(window);
