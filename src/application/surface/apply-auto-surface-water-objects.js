"use strict";

/* Replace stale automatic OSM surface evidence and roll back if repartition fails. */
window.DG_APPLY_AUTO_SURFACE_WATER_OBJECTS={
  async apply({record,objects,epoch,getEpoch,getRecord,repartition,dirty}){
    if(!objects.length)return 0;
    const managed=feature=>["building","hard","water","pool"].includes(feature.type)&&feature.method==="osm-boundary";
    const ids=new Set(objects.map(feature=>feature.osmId)),existing=record.objectFeatures||[],next=[...existing.filter(feature=>!managed(feature)),...objects];
    const changed=JSON.stringify(existing.filter(managed).map(feature=>[feature.type,feature.osmId,feature.geometry]))!==JSON.stringify(objects.map(feature=>[feature.type,feature.osmId,feature.geometry]));
    const superseded=(record.features||[]).filter(feature=>feature.method==="visual-boundary"&&feature.source==="osm-selected"&&ids.has(feature.osmId));
    if(!changed&&!superseded.length)return objects.length;
    const previous=record.objectFeatures,previousFeatures=record.features;record.objectFeatures=next;
    const features=(record.features||[]).filter(feature=>!superseded.includes(feature)),ok=await repartition(features);
    if(!ok){record.objectFeatures=previous;record.features=previousFeatures;return 0;}
    if(epoch!==getEpoch()||getRecord()!==record)return 0;
    record.objectVersion="footprints-v5-osm-all";dirty();return objects.length;
  }
};
