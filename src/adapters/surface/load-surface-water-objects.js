"use strict";

/* Fetch OSM evidence and retain valid building, road, and water footprints. */
window.DG_LOAD_SURFACE_WATER_OBJECTS={
  async load({enabled,loadOsmData,bbox,buildObjects,epsg,validFeature,isCurrent,fromMount,isUnavailable}){
    if(!enabled||typeof loadOsmData!=="function"||typeof buildObjects!=="function")return[];
    const data=await loadOsmData(bbox).catch(()=>null);
    if(!data?.elements?.length||!isCurrent()||(fromMount&&isUnavailable()))return[];
    return buildObjects(data.elements,epsg).filter(feature=>(feature.type==="building"||feature.type==="hard"||feature.type==="water"||feature.type==="pool")&&validFeature(feature));
  }
};
