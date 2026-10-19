"use strict";
/* Read-only navigation adapter for the public guided map tour. */
(function(root){
 function create(){
  function focusGoksu(){
   if(typeof map==="undefined"||!map)return false;
   if(typeof L!=="undefined"&&L.latLngBounds)map.fitBounds(L.latLngBounds([[39.9882092,32.6439304],[39.9974562,32.655579]]),{padding:[18,18],animate:false});
   else map.setView([39.992832,32.649755],15,{animate:false});
   map.invalidateSize();return true;
  }
  function parkMode(){return typeof PARK_MODE!=="undefined"&&PARK_MODE===true;}
  return Object.freeze({focusGoksu,parkMode});
 }
 root.DG_GUIDED_MAP_DEMO_ADAPTER=Object.freeze({create});
})(window);
