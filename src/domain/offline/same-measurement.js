"use strict";
/* Prove a queued replay is the same owned scientific measurement. */
(function(root){
  const fields=["project_id","point_id","measurement_no","grp","species","girth_cm","dbh_cm","height_m","volume_m3","carbon_kg","lat","lon"];
  function same(local,remote){
    if(!remote||String(remote.owner)!==String(local.owner)||remote.client_id!==local.client_id)return false;
    return fields.every(key=>String(local[key]??"")===String(remote[key]??""))&&(!local.photoBlob||!!remote.photo_url);
  }
  root.DG_OFFLINE_MEASUREMENT_MATCH=Object.freeze({same});
})(window);
