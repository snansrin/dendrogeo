"use strict";

/* Refresh only panels visible to the user after a committed queue drain. */
(function(root){
  function run({isVisible,loadDash,loadRecords,loadAdmin,loadWorld,markMapDirty,loadLiveMap}){
    if(isVisible('v-dash'))loadDash();
    if(isVisible('v-records'))loadRecords();
    if(isVisible('v-admin'))loadAdmin();
    if(isVisible('v-world'))loadWorld();
    markMapDirty();
    if(isVisible('v-map'))loadLiveMap();
  }
  root.DG_REFRESH_AFTER_OFFLINE_MEASUREMENT_SYNC=Object.freeze({run});
})(window);
