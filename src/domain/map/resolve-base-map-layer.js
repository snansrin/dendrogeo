"use strict";

window.DG_RESOLVE_BASE_MAP_LAYER={
  resolve(type,attribution){
    const layers={
      osm:{url:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",label:"Sokak",maxNativeZoom:19},
      sat:{url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false",label:"Uydu",maxNativeZoom:23},
      topo:{url:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",label:"Topoğrafik",maxNativeZoom:17}
    };
    const layer=layers[type];
    return layer?{...layer,type,attribution:attribution[type],maxZoom:type==="sat"?23:22,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false}:null;
  }
};
