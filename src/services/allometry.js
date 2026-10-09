"use strict";
/* Compatibility adapter for existing forms/reports. Species lookup and the
 * legacy circumference entry point stay here; the equation is in domain/trees. */
const DG_TREE_CARBON_USE_CASE=window.DG_TREE_CARBON_APPLICATION.createTreeCarbonUseCase({
 calculateAllometry:window.DG_TREE_ALLOMETRY.calculate,
 resolveDensity:(species,group)=>(typeof densityKgFor==="function")?densityKgFor(species,group):null
});
const DG_TREE_CIRCUMFERENCE_USE_CASE=window.DG_TREE_CIRCUMFERENCE_APPLICATION.createCircumferenceCarbonUseCase({
 calculateCarbon:input=>calc(input.dbhCm,input.heightM,input.species,input.group),
 diameterFromCircumference:c=>(typeof diameterCmFromCircumference==="function")?diameterCmFromCircumference(c):null
});
function calc(dbh,h,sp,grp){
 return DG_TREE_CARBON_USE_CASE.calculate({dbhCm:dbh,heightM:h,species:sp,group:grp});
}
function calcFromCircumference(circumferenceCm,h,sp,grp){
 return DG_TREE_CIRCUMFERENCE_USE_CASE.calculate({circumferenceCm,heightM:h,species:sp,group:grp});
}
