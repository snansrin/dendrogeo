"use strict";
function calc(circumferenceCm,h,sp,grp){
 const zero={valid:false,density_kg_m3:null,circumference_cm:null,dbh_cm:null,agb:0,bhb:0,bio:0,c_agb:0,c_bhb:0,total_carbon:0,vol:0};
 const c=Number(circumferenceCm), height=Number(h);
 if(!Number.isFinite(c)||!Number.isFinite(height)||c<=0||height<=0)return zero;
 /*
  * TEK ÖLÇÜM PROTOKOLÜ:
  * - measurements.dbh_cm saha mezurasıyla ölçülen GÖĞÜS ÇEVRESİNİ taşır;
  * - allometri DBH çapını yalnız diameterCmFromCircumference() ile türetir;
  * - doğrudan çevreyi D gibi kullanmak yasaktır.
  *
  * TEK YOĞUNLUK KURALI:
  * - yoğunluğu yalnız densityKgFor() çözer;
  * - densityKgFor() yalnız kilitli tablo + İBRELİ/YAPRAKLI genelini kullanır;
  * - bilinmeyen tür, yanlış grup ve DİĞER karbon hesabı üretemez.
  */
 const d=(typeof diameterCmFromCircumference==="function")?diameterCmFromCircumference(c):null;
 if(!(d>0)||d>400)return zero;
 const densityKg=(typeof densityKgFor==="function")?densityKgFor(sp,grp):null;
 if(!(densityKg>0))return zero;
 const r=densityKg/1000;
 const agb=0.0673*Math.pow(r*d*d*height,0.976);
 const bhb=agb*0.26,bio=agb+bhb;
 return{
  valid:true,density_kg_m3:densityKg,circumference_cm:c,dbh_cm:d,
  agb,bhb,bio,
  c_agb:agb*0.47,c_bhb:bhb*0.47,total_carbon:bio*0.47,
  vol:Math.PI*Math.pow(d/200,2)*height*0.5
 };
}
