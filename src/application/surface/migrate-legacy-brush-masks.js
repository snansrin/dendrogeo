"use strict";

/* Convert persisted continuous brush masks into undoable raster-cell decisions. */
window.DG_LEGACY_BRUSH_MASK_MIGRATION={
  migrate({record,cells,geometries,park,epsg,polygonClipping,featureGeometry,bounds,area,overlap,cellKey,timestamp,createDecision,appendHistory}){
    const old=Array.isArray(record?.features)?record.features:[];
    if(!old.some(feature=>feature.method==="visual-brush"))return false;
    const keep=[];record.corrections=record.corrections&&typeof record.corrections==="object"?record.corrections:{};
    let migrated=false;
    for(let i=0;i<old.length;i++){
      const feature=old[i];if(feature.method!=="visual-brush"){keep.push(feature);continue;}
      let mask=[];try{mask=polygonClipping.intersection(featureGeometry(feature,epsg),park);}catch(e){}
      if(!mask.length){keep.push(feature);continue;}
      const maskBounds=bounds(mask),ts=feature.ts||timestamp(),strokeId="legacy-"+ts+"-"+i,changes=[];
      for(const cell of cells||[]){
        const key=cellKey(cell),cellGeometry=geometries[key];if(!cellGeometry?.length||!overlap(maskBounds,cellGeometry))continue;
        if(area(polygonClipping.intersection(cellGeometry,mask))<=.01)continue;
        const previous=record.corrections?.[key]?{...record.corrections[key]}:null;
        const applied=createDecision({cell,toClass:feature.type,timestamp:ts,strokeId})||{key,decision:{from:cell.classKey,to:feature.type,method:"visual-cell",ts,brushStrokeId:strokeId}};
        record.corrections[key]=applied.decision;changes.push({key,before:previous,strokeId});
      }
      if(changes.length){appendHistory(record,{id:strokeId,changes,ts});migrated=true;}else keep.push(feature);
    }
    if(migrated)record.features=keep;
    return migrated;
  }
};
