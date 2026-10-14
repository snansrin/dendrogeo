"use strict";

/* Fetch OSM evidence and retain valid building, road, and water footprints. */
window.DG_LOAD_SURFACE_WATER_OBJECTS={
  async load({enabled,loadOsmData,bbox,buildObjects,epsg,validFeature,isCurrent,fromMount,isUnavailable,onEvidence=()=>{}}){
    if(!enabled||typeof loadOsmData!=="function"||typeof buildObjects!=="function")return[];
    const data=await loadOsmData(bbox).catch(()=>null);
    if(!isCurrent())return[];
    const evidence={status:data?.complete===true?"complete":data?.elements?.length?"partial":"unavailable",fetchedAt:data?.fetchedAt||null,objectCount:null};
    if(fromMount&&isUnavailable()){onEvidence({...evidence,status:"pending"});return[];}
    let objects=[];
    try{if(data?.elements?.length)objects=buildObjects(data.elements,epsg).filter(feature=>(feature.type==="building"||feature.type==="hard"||feature.type==="water"||feature.type==="pool")&&validFeature(feature));}
    catch(error){onEvidence({...evidence,status:"unavailable"});return[];}
    onEvidence({...evidence,objectCount:objects.length});return objects;
  }
};
