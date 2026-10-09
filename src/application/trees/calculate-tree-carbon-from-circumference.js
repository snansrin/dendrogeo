"use strict";
/* Field measurement use-case: translate circumference through the locked
 * protocol, then delegate carbon calculation to the existing tree use-case. */
(function(root){
  function createCircumferenceCarbonUseCase({calculateCarbon,diameterFromCircumference}){
    if(typeof calculateCarbon!=="function"||typeof diameterFromCircumference!=="function")
      throw new TypeError("Çevre ölçümü akışı için karbon ve protokol portları gereklidir.");
    return Object.freeze({
      calculate({circumferenceCm,heightM,species,group}){
        const circumference=Number(circumferenceCm);
        const dbhCm=diameterFromCircumference(circumference);
        const result=calculateCarbon({dbhCm,heightM,species,group});
        return result.valid
          ? Object.assign({},result,{circumference_cm:circumference})
          : Object.assign({},result,{circumference_cm:Number.isFinite(circumference)?circumference:null});
      }
    });
  }
  root.DG_TREE_CIRCUMFERENCE_APPLICATION=Object.freeze({createCircumferenceCarbonUseCase});
})(window);
