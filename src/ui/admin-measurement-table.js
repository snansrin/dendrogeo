"use strict";
(function(root){
 function render(rows,{renderRow}){
  return (rows||[]).slice()
   .sort((a,b)=>((+a.project_id||0)-(+b.project_id||0))||((+a.point_id||0)-(+b.point_id||0))||((+a.measurement_no||1)-(+b.measurement_no||1)))
   .slice(0,300).map(renderRow).join("")||"<tr><td colspan=9>Kayıt yok.</td></tr>";
 }
 root.DG_ADMIN_MEASUREMENT_TABLE_UI=Object.freeze({render});
})(window);
