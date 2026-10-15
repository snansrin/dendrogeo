"use strict";

/* Resolve the displayed class without mutating the measured raster cell. */
window.DG_CLASSIFY_EFFECTIVE_SURFACE_CELL={
  classify({cell,rawView,record,editing,hasWaterFootprint,waterOutsideClass,classes,types,cellKey,edgeAreaM2,predict}){
    const original=cell.rasterClassKey||cell.classKey;
    if(rawView)return original;
    const decision=record?.corrections?.[cellKey(cell)];
    if(original==="water"&&hasWaterFootprint)return waterOutsideClass(cell,record);
    if(decision&&(decision.method==="visual-cell"||!editing)){
      return types[decision.to]?(decision.to==="pool"?"water":decision.to):original;
    }
    if(!editing||!record?.spectralEnabled||Number(cell.areaM2)<edgeAreaM2)return original;
    const sensitivity=record.sens;
    if(!classes.some(key=>Number(sensitivity[key])!==50))return original;
    const predicted=predict(record.profile?.cells?.[cellKey(cell)],sensitivity);
    if(!classes.includes(predicted))return original;
    return Number(sensitivity[predicted])!==50||Number(sensitivity[original])!==50?predicted:original;
  }
};
