"use strict";
/* Compatibility adapter for existing forms/reports. Species lookup and the
 * legacy circumference entry point stay here; the equation is in domain/trees. */
const DG_TREE_CARBON_USE_CASE=window.DG_TREE_CARBON_APPLICATION.createTreeCarbonUseCase({
 calculateAllometry:window.DG_TREE_ALLOMETRY.calculate,
 resolveDensity:(species,group)=>(typeof densityKgFor==="function")?densityKgFor(species,group):null
});
function calc(dbh,h,sp,grp){
 return DG_TREE_CARBON_USE_CASE.calculate({dbhCm:dbh,heightM:h,species:sp,group:grp});
}
function calcFromCircumference(circumferenceCm,h,sp,grp){
 const c=Number(circumferenceCm);
 const d=(typeof diameterCmFromCircumference==="function")?diameterCmFromCircumference(c):null;
 const r=calc(d,h,sp,grp);
 return r.valid?Object.assign({},r,{circumference_cm:c}):Object.assign({},r,{circumference_cm:Number.isFinite(c)?c:null});
}
