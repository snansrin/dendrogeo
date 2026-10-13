"use strict";

/* Resolve a point to a verified OSM polygon, preferring the smallest containing object. */
window.DG_SURFACE_OBJECT_PICKER={
  find({latlng,elements,storedFeatures,epsg,parkGeometry,cellGeometry,project,unproject,forward,featureGeometry,bounds,pointDistance,clip,area,objects,validFeature}){
    if(!elements.length&&storedFeatures.length&&latlng){
      const point=forward(latlng.lat,latlng.lng,epsg);
      for(const feature of storedFeatures){
        if(!validFeature(feature))continue;
        for(const polygon of featureGeometry(feature,epsg)){
          const box=bounds([polygon]);if(point.x<box[0]||point.x>box[2]||point.y<box[1]||point.y>box[3])continue;
          if(pointDistance([point.x,point.y],[polygon])>=0)return{type:feature.type,geometry:feature.geometry,osmId:feature.osmId||"OSM"};
        }
      }
    }
    if(!latlng||!Array.isArray(elements)||!cellGeometry||!parkGeometry||typeof objects!=="function")return null;
    const point=forward(latlng.lat,latlng.lng,epsg),candidates=objects(elements,epsg);let best=null;
    for(const feature of candidates){
      const polygons=feature.geometry?.type==="MultiPolygon"?feature.geometry.coordinates.map(polygon=>polygon.map(ring=>project(ring,epsg))):[];
      for(const polygon of polygons){
        const box=bounds([polygon]);if(point.x<box[0]-8||point.x>box[2]+8||point.y<box[1]-8||point.y>box[3]+8)continue;
        const distance=pointDistance([point.x,point.y],[polygon]);if(distance< -8)continue;
        const polygonArea=area([polygon]),score=distance>=0?polygonArea/1e9:8+Math.abs(distance);
        if(!best||score<best.score)best={feature,geometry:[polygon],score};
      }
    }
    if(!best)return null;
    const clipped=clip("intersection",best.geometry,parkGeometry);
    if(!clipped.length||area(clipped)<.1)return null;
    const geometry={type:"MultiPolygon",coordinates:unproject(clipped,epsg)};
    if(!validFeature({type:best.feature.type,geometry}))return null;
    return{type:best.feature.type,geometry,osmId:best.feature.osmId||"OSM"};
  }
};
