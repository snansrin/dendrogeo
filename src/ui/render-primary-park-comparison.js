"use strict";

/* Store primary park rows and render linked/pending sections through injected UI ports. */
window.DG_RENDER_PRIMARY_PARK_COMPARISON={
 render(rows,{setRows,prepare,element,renderLinked,renderPending,renderReportOptions}){
  setRows(rows);
  if(!element)return null;
  const prepared=prepare(rows),linked=prepared.linked,pending=prepared.pending;
  const max=prepared.max;
  element.innerHTML=(linked.length?renderLinked(linked,max)
   :'<div style="color:var(--mut);font-size:.85rem">Henüz park kimliğine bağlı onaylı kayıt yok. Ölçüm girmeden önce park algıla: Canlı Harita → 🌳 Park Algılama.</div>')
   +renderPending(pending);
  renderReportOptions(linked,pending);
  return{linked,pending,max};
 }
};
