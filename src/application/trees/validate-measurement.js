"use strict";
/* Ordered field-measurement gate. Scientific limits stay behind the locked
 * density and circumference ports; this use-case owns only decision order. */
(function(root){
  function createTreeMeasurementValidator({measurementGroups,resolveDensity,isCircumferenceValid}){
    if(!Array.isArray(measurementGroups)||typeof resolveDensity!=="function"||typeof isCircumferenceValid!=="function")
      throw new TypeError("Saha ölçümü doğrulaması için grup, yoğunluk ve protokol bağımlılıkları gereklidir.");
    const groups=Object.freeze(measurementGroups.slice());
    function validateBiometrics({group,species,circumferenceCm,heightM}){
      if(!group)return {valid:false,reason:"GROUP_REQUIRED"};
      if(!groups.includes(group))return {valid:false,reason:"GROUP_UNSUPPORTED"};
      if(!species)return {valid:false,reason:"SPECIES_REQUIRED"};
      if(!(resolveDensity(species,group)>0))return {valid:false,reason:"DENSITY_MISSING"};
      if(!Number.isFinite(circumferenceCm)||!isCircumferenceValid(circumferenceCm))
        return {valid:false,reason:"CIRCUMFERENCE_INVALID"};
      if(!Number.isFinite(heightM)||heightM<=0||heightM>100)return {valid:false,reason:"HEIGHT_INVALID"};
      return {valid:true,reason:null};
    }
    return Object.freeze({
      validateBiometrics,
      validateNewMeasurement({projectId,pointId,measurementNo,group,species,circumferenceCm,heightM}){
        if(!projectId)return {valid:false,reason:"PROJECT_REQUIRED"};
        if(!Number.isSafeInteger(pointId)||pointId<=0)return {valid:false,reason:"POINT_ID_INVALID"};
        if(!Number.isSafeInteger(measurementNo)||measurementNo<=0)return {valid:false,reason:"MEASUREMENT_NO_INVALID"};
        return validateBiometrics({group,species,circumferenceCm,heightM});
      }
    });
  }
  root.DG_TREE_MEASUREMENT_APPLICATION=Object.freeze({createTreeMeasurementValidator});
})(window);
