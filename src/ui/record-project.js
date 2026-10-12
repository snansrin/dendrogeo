"use strict";
(function(root){
 function render(name,rows,{renderItem,escape}){
  const carbon=rows.reduce((sum,row)=>sum+(Number(row.carbon_kg)||0),0);
  const approved=rows.filter(row=>row.status==="Onaylı").length;
  const pending=rows.filter(row=>!row.status||row.status==="Beklemede").length;
  const body=rows.map(renderItem).join("");
  return `<details class="record-project">
  <summary><div class="record-project-title"><span class="record-project-icon">📁</span><span><b>${escape(name)||"Projesiz kayıtlar"}</b><small>${rows.length} kayıt · ${approved} onaylı${pending?" · "+pending+" bekliyor":""}</small></span></div><div class="record-project-total"><b>${carbon.toFixed(1)}</b><span>kg C</span></div></summary>
  <div class="record-project-body">${body}</div>
 </details>`;
 }
 root.DG_RECORD_PROJECT_UI=Object.freeze({render});
})(window);
