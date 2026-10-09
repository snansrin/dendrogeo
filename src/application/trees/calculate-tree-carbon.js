"use strict";
/* Tree carbon use-case. It resolves a trusted species density through an
 * injected port, then delegates the equation to the pure domain module. */
(function(root){
  function createTreeCarbonUseCase({calculateAllometry,resolveDensity}){
    if(typeof calculateAllometry!=="function"||typeof resolveDensity!=="function")
      throw new TypeError("Ağaç karbon akışı için hesap ve yoğunluk portları gereklidir.");
    return Object.freeze({
      calculate({dbhCm,heightM,species,group}){
        const densityKgM3=resolveDensity(species,group);
        return calculateAllometry({dbhCm,heightM,densityKgM3});
      }
    });
  }
  root.DG_TREE_CARBON_APPLICATION=Object.freeze({createTreeCarbonUseCase});
})(window);
