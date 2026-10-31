"use strict";
/* Draw approved measurement markers in cancellable chunks on a cluster layer. */
(function(root){
  function add(map,rows,chunk,{leaflet,popupHTML,log=console,setTimer=setTimeout}){
    if(root.DG_ADD_MEASUREMENT_MARKERS&&root.DG_ADD_MEASUREMENT_MARKERS.add(map,rows,chunk,{leaflet,popupHTML,log,setTimer}))return;
    let i=0;
    if(!map._cluster){
      if(typeof leaflet.markerClusterGroup==="function"){
        map._cluster=leaflet.markerClusterGroup({
          maxClusterRadius:80,
          spiderfyOnMaxZoom:true,
          showCoverageOnHover:false,
          disableClusteringAtZoom:15,
          iconCreateFunction:cluster=>{
            const count=cluster.getChildCount();
            const size=count<10?"small":count<50?"medium":"large";
            return leaflet.divIcon({html:`<div>${count}</div>`,className:`marker-cluster marker-cluster-${size}`,iconSize:[40,40]});
          }
        });
        map._clusterDegraded=false;
      }else{
        log.warn("DENDROGEO · markercluster eklentisi yok → noktalar kümelenmeden çiziliyor");
        map._cluster=leaflet.layerGroup();
        map._clusterDegraded=true;
      }
      map.addLayer(map._cluster);
    }else map._cluster.clearLayers();
    const token=map._markerToken=(map._markerToken||0)+1;
    (function step(){
      if(token!==map._markerToken)return;
      const end=Math.min(i+chunk,rows.length);
      for(;i<end;i++){
        const row=rows[i];
        const color=(typeof GROUP_COLOR!=="undefined"&&GROUP_COLOR[row.grp])||(row.grp==="YAPRAKLI"?"#c77d2e":"#1e6f4b");
        const marker=leaflet.marker([row.lat,row.lon],{
          icon:leaflet.divIcon({
            className:'tree-marker',
            html:`<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
            iconSize:[18,18],iconAnchor:[9,9]
          })
        });
        marker.bindPopup(popupHTML(row));
        map._cluster.addLayer(marker);
      }
      if(i<rows.length)setTimer(step,16);
    })();
  }
  root.DG_MAP_MEASUREMENT_MARKERS=Object.freeze({add});
})(window);
