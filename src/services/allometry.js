"use strict";
function calc(dbh,h,sp,grp){
 const zero={valid:false,density_kg_m3:null,dbh_cm:null,agb:0,bhb:0,bio:0,c_agb:0,c_bhb:0,total_carbon:0,vol:0};
 const d=Number(dbh),height=Number(h);
 if(!Number.isFinite(d)||!Number.isFinite(height)||d<=0||height<=0||d>400)return zero;
 const densityKg=(typeof densityKgFor==="function")?densityKgFor(sp,grp):null;
 if(!(densityKg>0))return zero;
 const r=densityKg/1000;
 const agb=0.0673*Math.pow(r*d*d*height,0.976);
 const bhb=agb*0.26,bio=agb+bhb;
 return{
  valid:true,density_kg_m3:densityKg,dbh_cm:d,
  agb,bhb,bio,
  c_agb:agb*0.47,c_bhb:bhb*0.47,total_carbon:bio*0.47,
  vol:Math.PI*Math.pow(d/200,2)*height*0.5
 };
}
function calcFromCircumference(circumferenceCm,h,sp,grp){
 const c=Number(circumferenceCm);
 const d=(typeof diameterCmFromCircumference==="function")?diameterCmFromCircumference(c):null;
 const r=calc(d,h,sp,grp);
 return r.valid?Object.assign({},r,{circumference_cm:c}):Object.assign({},r,{circumference_cm:Number.isFinite(c)?c:null});
}
