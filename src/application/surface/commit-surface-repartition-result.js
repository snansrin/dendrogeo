"use strict";

/* Commit staged geometry only after preparation and the editor epoch gate pass. */
window.DG_COMMIT_SURFACE_REPARTITION_RESULT={
  commit({state,record,featureOverride,data,cells,epsg,migrateBrushMasks,resolveParts,effective,features,cellKey,seed,clearLayers,map}){
    if(featureOverride)record.features=featureOverride;
    if(!record.objectFeatures){record.objectFeatures=data.objects;record.objectVersion="footprints-v6-road-width-policy";}
    state.partitionVersion=(state.partitionVersion||0)+1;state.vegetationRenderKey=null;state.vegetationLayer?.clearLayers();state.parkGeometry=data.park;state.geometry=data.geometries;
    if(migrateBrushMasks(record,cells,data.geometries,data.park,epsg)){record.draftDirty=true;state.editing=true;state.visualVersion++;data.parts=resolveParts(cells,effective,data.geometries,features(),epsg,data.park);}
    const byKey=new Map(cells.map(cell=>[cellKey(cell),cell]));for(const part of data.parts)part.cell=byKey.get(part.key);
    seed(data.geometries,features(),epsg,data.park,data.parts,cells);
    state.partsMemo=null;state.visualMemo=null;clearLayers({state,map});
  }
};
