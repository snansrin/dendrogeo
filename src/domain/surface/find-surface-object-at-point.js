"use strict";

/* Resolve a point to a verified OSM polygon, preferring the smallest containing object. */
window.DG_SURFACE_OBJECT_PICKER=(function(){
  const projectedCache=new WeakMap(),objectCache=new WeakMap();
  function projected(feature,epsg,featureGeometry,project){
    const geometry=feature?.geometry,old=projectedCache.get(feature);
    if(old?.geometry===geometry&&old.epsg===epsg)return old.polygons;
    const source=typeof featureGeometry==="function"?featureGeometry(feature,epsg):geometry?.type==="MultiPolygon"?geometry.coordinates.map(polygon=>polygon.map(ring=>project(ring,epsg))):[];
    const polygons=source.map(geom=>({geom,bounds:null,area:null}));
    projectedCache.set(feature,{geometry,epsg,polygons});return polygons;
  }
  return Object.freeze({find({latlng,elements,storedFeatures,epsg,parkGeometry,cellGeometry,project,unproject,forward,featureGeometry,bounds,pointDistance,clip,area,objects,validFeature}){
    if(storedFeatures.length&&latlng){
      const point=forward(latlng.lat,latlng.lng,epsg);
      let best=null;
      for(const feature of storedFeatures){
        if(!validFeature(feature))continue;
        for(const item of projected(feature,epsg,featureGeometry,project)){
          const polygon=item.geom,box=item.bounds||(item.bounds=bounds([polygon]));
          if(point.x<box[0]-8||point.x>box[2]+8||point.y<box[1]-8||point.y>box[3]+8)continue;
          const distance=pointDistance([point.x,point.y],[polygon]);if(distance< -8)continue;
          const size=item.area??(item.area=area([polygon]));
          // Match live OSM hit tolerance for thin cached road polygons on touch screens.
          const score=distance>=0?size/1e9:8+Math.abs(distance);
          if(!best||score<best.score)best={feature,score};
        }
      }
      if(best)return{type:best.feature.type,geometry:best.feature.geometry,osmId:best.feature.osmId||"OSM"};
    }
    if(!latlng||!Array.isArray(elements)||!cellGeometry||!parkGeometry||typeof objects!=="function")return null;
    const point=forward(latlng.lat,latlng.lng,epsg);let cached=objectCache.get(elements);
    if(!cached||cached.epsg!==epsg||cached.parkGeometry!==parkGeometry){cached={epsg,parkGeometry,features:objects(elements,epsg)};objectCache.set(elements,cached);}
    const candidates=cached.features;let best=null;
    for(const feature of candidates){
      for(const item of projected(feature,epsg,featureGeometry,project)){
        const polygon=item.geom,box=item.bounds||(item.bounds=bounds([polygon]));if(point.x<box[0]-8||point.x>box[2]+8||point.y<box[1]-8||point.y>box[3]+8)continue;
        const distance=pointDistance([point.x,point.y],[polygon]);if(distance< -8)continue;
        const polygonArea=item.area??(item.area=area([polygon])),score=distance>=0?polygonArea/1e9:8+Math.abs(distance);
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
  });
})();
