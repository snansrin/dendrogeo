"use strict";

/* Build auditable GeoJSON features for reviewed and spectrally flagged cells. */
window.DG_BUILD_VALIDATION_CORRECTED_GEOJSON={
  build(cells,corrections,spectralCells,{predict,defaults}){
    const features=[];
    for(const cell of(cells||[])){
      const key=cell.row+":"+cell.col,record=(corrections||{})[key],evidence=(spectralCells||{})[key];if(!record&&!evidence)continue;
      const prediction=evidence?predict(evidence):null,flagged=prediction&&prediction!==cell.classKey&&prediction!=="ambiguous"&&prediction!=="nodata"&&Number(cell.areaM2||0)>=defaults.edgeAreaM2;
      if(!record&&!flagged)continue;
      const status=record?(record.to&&record.to!==record.from?"corrected":"confirmed"):"pending",ring=cell.quadWgs&&cell.quadWgs.length===4?[...cell.quadWgs,cell.quadWgs[0]]:[[cell.center.lon,cell.center.lat]];
      features.push({type:"Feature",properties:{row:cell.row,column:cell.col,original_class:cell.classKey,adjudicated_class:record&&record.to&&record.to!==record.from?record.to:null,status,spectral_predict:prediction||"",area_m2:+Number(cell.areaM2||0).toFixed(3),ndvi:evidence&&evidence.ndvi!==undefined?evidence.ndvi:null,mndwi:evidence&&evidence.mndwi!==undefined?evidence.mndwi:null,mndwi_year_max:evidence&&(evidence.mndwiMaxYear!==undefined?evidence.mndwiMaxYear:evidence.mndwiMax)||null,ndvi_season_max:evidence&&(evidence.ndviMaxYear!==undefined?evidence.ndviMaxYear:evidence.ndviMax)||null,adjudicated_at:record?record.ts||"":null},geometry:{type:"Polygon",coordinates:[ring]}});
    }
    return{type:"FeatureCollection",name:"dendrogeo_adjudicated_cells",features};
  }
};
