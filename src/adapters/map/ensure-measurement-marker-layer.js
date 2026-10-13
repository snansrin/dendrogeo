"use strict";

window.DG_ENSURE_MEASUREMENT_MARKER_LAYER={
  ensure(map,{leaflet,log,clusterIcon}){
    if(map._cluster){map._cluster.clearLayers();return;}
    if(typeof leaflet.markerClusterGroup==="function"){
      map._cluster=leaflet.markerClusterGroup({maxClusterRadius:80,spiderfyOnMaxZoom:true,showCoverageOnHover:false,disableClusteringAtZoom:15,iconCreateFunction:cluster=>clusterIcon(cluster.getChildCount(),leaflet)});
      map._clusterDegraded=false;
    }else{
      log.warn("DENDROGEO · markercluster eklentisi yok → noktalar kümelenmeden çiziliyor");
      map._cluster=leaflet.layerGroup();
      map._clusterDegraded=true;
    }
    map.addLayer(map._cluster);
  }
};
