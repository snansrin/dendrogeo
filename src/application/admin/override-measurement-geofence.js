"use strict";
(function(root){
 async function execute(sb,id,userId,store){return store.setGeoOverride(sb,id,userId);}
 root.DG_ADMIN_OVERRIDE_MEASUREMENT_GEOFENCE=Object.freeze({execute});
})(window);
