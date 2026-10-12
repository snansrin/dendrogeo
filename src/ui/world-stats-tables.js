"use strict";
(function(root){
 function countries(rows,escape){
  return(rows||[]).slice(0,30).map(row=>`<tr><td data-label="Ülke">${escape(row.country)}</td><td data-label="Kayıt">${row.records}</td><td data-label="Karbon(t)">${row.carbon_t}</td><td data-label="Ort.Çap">${Number.isFinite(+row.avg_dbh)?(+row.avg_dbh).toFixed(1):"—"}</td><td data-label="Ort.Yükseklik(m)">${row.avg_height||"—"}</td></tr>`).join("")||"<tr><td colspan=5>—</td></tr>";
 }
 function cities(rows,escape){
  return(rows||[]).slice(0,30).map(row=>`<tr><td data-label="Şehir">${escape(row.city)}</td><td data-label="Kayıt">${row.records}</td><td data-label="Karbon(t)">${row.carbon_t}</td></tr>`).join("")||"<tr><td colspan=3>—</td></tr>";
 }
 root.DG_WORLD_STATS_TABLES=Object.freeze({countries,cities});
})(window);
