"use strict";
/* Restore a verified, persisted park geometry. Never synthesize an area or
 * replace the park's existing database identity when opening a project. */
(function(root){
 function candidate(row){
  if(!row||!Number.isSafeInteger(Number(row.id))||!Array.isArray(row.geom_json?.outer)||!row.geom_json.outer.some(r=>Array.isArray(r)&&r.length>=4))
   throw Error("Projenin kayıtlı park sınırı bulunamadı. Kayıt değiştirilmedi.");
  if(String(row.osm_key||"").startsWith("stage/"))return root.DG_PARK_STAGE_GEOMETRY.candidate(row);
  const osm=/^(node|way|relation)\/(\d+)$/.exec(String(row.osm_key||""));
  if(!osm&&row.source!=="manual")throw Error("Kayıtlı park kimliği tanınmadı. Kayıt değiştirilmedi.");
  return {name:row.name,source:osm?"osm":"manual",type:osm?osm[1]:"manual",id:osm?Number(osm[2]):undefined,
   area:row.area_m2,rings:{outer:row.geom_json.outer,inner:row.geom_json.inner||[]}};
 }
 root.DG_LIVE_MAP_PROJECT_CANDIDATE=Object.freeze({candidate});
})(window);
