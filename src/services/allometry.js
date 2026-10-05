"use strict";
function calc(dbh,h,sp,grp){
if(!dbh||!h||dbh<=0||h<=0)return{agb:0,bhb:0,bio:0,c_agb:0,c_bhb:0,total_carbon:0,vol:0};
/*
 * Yoğunluk çözüm sırası:
 * 1) tür adı/eşanlamlı/Latince ad → kanonik tür,
 * 2) kilitli tür yoğunluğu,
 * 3) kilitli grup geneli,
 * 4) yalnız geriye dönük belirsiz kayıtlar için DİĞER fallback.
 *
 * Böylece "Sığla", "SIĞLA" ve "Liquidambar orientalis" aynı 468 kg/m³
 * değerini kullanır; tür eklemek kanonik yoğunluk tablosunu ezemez.
 */
const canonical=(typeof resolveSpeciesName==="function"&&resolveSpeciesName(sp))||sp;
const densityKg=(rho[canonical]??GROUP_DEFAULT_RHO[grp]??GROUP_DEFAULT_RHO["DİĞER"]);
const r=densityKg/1000;
const agb=0.0673*Math.pow(r*dbh*dbh*h,0.976);
const bhb=agb*0.26,bio=agb+bhb;
return{agb,bhb,bio,c_agb:agb*0.47,c_bhb:bhb*0.47,total_carbon:bio*0.47,vol:Math.PI*Math.pow(dbh/200,2)*h*0.5};
}
