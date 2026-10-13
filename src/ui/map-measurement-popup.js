"use strict";
/* Build the established measurement marker popup with escaped labels. */
(function(root){
  function render(row,{escapeHTML,translate}){
    return `<div style="min-width:140px"><b>P${row.point_id}</b> · ${escapeHTML(translate(row.species))}<br><span style="font-size:.75rem;color:#5f6d65">DBH: ${Number.isFinite(+row.dbh_cm)?(+row.dbh_cm).toFixed(1):"—"} cm · ${translate("Boy")}: ${row.height_m||"—"} m<br>${translate("Karbon")}: ${(row.carbon_kg||0).toFixed(1)} kg</span>`+(row.photo_url?`<br><img src="${escapeHTML(row.photo_url)}" style="width:160px;border-radius:8px;margin-top:6px">`:"")+`</div>`;
  }
  root.DG_MAP_MEASUREMENT_POPUP=Object.freeze({render});
})(window);
