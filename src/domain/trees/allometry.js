"use strict";
/* Pure tree allometry domain rule. It knows numeric inputs and the published
 * equation only; species lookup and field-unit conversion live above it. */
(function(root){
  function calculate({dbhCm,heightM,densityKgM3}){
    const empty={valid:false,density_kg_m3:null,dbh_cm:null,agb:0,bhb:0,bio:0,c_agb:0,c_bhb:0,total_carbon:0,vol:0};
    const d=Number(dbhCm),h=Number(heightM),density=Number(densityKgM3);
    if(!Number.isFinite(d)||!Number.isFinite(h)||!Number.isFinite(density)||d<=0||h<=0||d>400||density<=0)return empty;
    const r=density/1000;
    const agb=0.0673*Math.pow(r*d*d*h,0.976);
    const bhb=agb*0.26,bio=agb+bhb;
    return{
      valid:true,density_kg_m3:density,dbh_cm:d,
      agb,bhb,bio,
      c_agb:agb*0.47,c_bhb:bhb*0.47,total_carbon:bio*0.47,
      vol:Math.PI*Math.pow(d/200,2)*h*0.5
    };
  }
  root.DG_TREE_ALLOMETRY=Object.freeze({calculate});
})(window);
