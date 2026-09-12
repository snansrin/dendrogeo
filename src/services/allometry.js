"use strict";
function calc(dbh,h,sp,grp){
if(!dbh||!h||dbh<=0||h<=0)return{agb:0,bhb:0,bio:0,c_agb:0,c_bhb:0,total_carbon:0,vol:0};
/* Tür yoğunluğu bilinmiyorsa: "diğer" hesap yöntemi -> gruba göre varsayılan yoğunluk (İbreli/Yapraklı farklı) */
const r=(rho[sp]||GROUP_DEFAULT_RHO[grp]||GROUP_DEFAULT_RHO["DİĞER"])/1000;
const agb=0.0673*Math.pow(r*dbh*dbh*h,0.976);
const bhb=agb*0.26,bio=agb+bhb;
return{agb,bhb,bio,c_agb:agb*0.47,c_bhb:bhb*0.47,total_carbon:bio*0.47,vol:Math.PI*Math.pow(dbh/200,2)*h*0.5};
}
