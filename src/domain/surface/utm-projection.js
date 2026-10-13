"use strict";
/* Snyder transverse-Mercator UTM projection, preserving [latitude, longitude]. */
(function(root){
  function epsgForLatLon(lat,lon){const zone=Math.max(1,Math.min(60,Math.floor((Number(lon)+180)/6)+1));return Number(lat)>=0?32600+zone:32700+zone;}
  function forward(lat,lon,epsg){
    const a=6378137,e2=0.0066943799901413165,ep2=e2/(1-e2),k0=.9996,la=Number(lat)*Math.PI/180,lo=Number(lon)*Math.PI/180,zone=Number(epsg)%100,south=Number(epsg)>=32700,lon0=((zone-1)*6-180+3)*Math.PI/180;
    const sin=Math.sin(la),cos=Math.cos(la),tan=Math.tan(la),N=a/Math.sqrt(1-e2*sin*sin),T=tan*tan,C=ep2*cos*cos,A=cos*(lo-lon0);
    const M=a*((1-e2/4-3*e2*e2/64-5*e2*e2*e2/256)*la-(3*e2/8+3*e2*e2/32+45*e2*e2*e2/1024)*Math.sin(2*la)+(15*e2*e2/256+45*e2*e2*e2/1024)*Math.sin(4*la)-(35*e2*e2*e2/3072)*Math.sin(6*la));
    const x=k0*N*(A+(1-T+C)*Math.pow(A,3)/6+(5-18*T+T*T+72*C-58*ep2)*Math.pow(A,5)/120)+500000;
    let y=k0*(M+N*tan*(A*A/2+(5-T+9*C+4*C*C)*Math.pow(A,4)/24+(61-58*T+T*T+600*C-330*ep2)*Math.pow(A,6)/720));if(south)y+=10000000;return{x,y};
  }
  function inverse(x,y,epsg){
    const a=6378137,e2=0.0066943799901413165,ep2=e2/(1-e2),k0=.9996,zone=Number(epsg)%100,south=Number(epsg)>=32700,lon0=((zone-1)*6-180+3)*Math.PI/180;let yy=Number(y);if(south)yy-=10000000;
    const M=yy/k0,mu=M/(a*(1-e2/4-3*e2*e2/64-5*e2*e2*e2/256)),e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
    const J1=3*e1/2-27*Math.pow(e1,3)/32,J2=21*e1*e1/16-55*Math.pow(e1,4)/32,J3=151*Math.pow(e1,3)/96,J4=1097*Math.pow(e1,4)/512;
    const fp=mu+J1*Math.sin(2*mu)+J2*Math.sin(4*mu)+J3*Math.sin(6*mu)+J4*Math.sin(8*mu),sin=Math.sin(fp),cos=Math.cos(fp),tan=Math.tan(fp),C1=ep2*cos*cos,T1=tan*tan,N1=a/Math.sqrt(1-e2*sin*sin),R1=a*(1-e2)/Math.pow(1-e2*sin*sin,1.5),D=(Number(x)-500000)/(N1*k0);
    const lat=fp-(N1*tan/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*ep2)*Math.pow(D,4)/24+(61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*Math.pow(D,6)/720);
    const lon=lon0+(D-(1+2*T1+C1)*Math.pow(D,3)/6+(5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*Math.pow(D,5)/120)/cos;return{lat:lat*180/Math.PI,lon:lon*180/Math.PI};
  }
  root.DG_SURFACE_UTM_PROJECTION=Object.freeze({epsgForLatLon,forward,inverse});
})(window);
