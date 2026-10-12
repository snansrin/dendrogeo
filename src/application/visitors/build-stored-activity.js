"use strict";

/* Compose stored owner activity rows from independently loaded datasets. */
window.DG_VISITOR_STORED_ACTIVITY_APPLICATION={
 create(){
  function build({measurements=[],projects=[],dataRequests=[],reportRequests=[]}={},
   {translate=value=>value,translateValue=value=>value}={}){
   const rows=[];
   for(const item of measurements||[]){
    const species=translateValue(item.species||"")||"—";
    const status=translateValue(item.status||"")||"—";
    rows.push({t:item.created_at,who:(item.profiles&&item.profiles.full_name)||"—",
     what:translate("ölçüm kaydı"),det:"P"+item.point_id+" · "+species+" · "+status});
   }
   for(const item of projects||[])rows.push({t:item.created_at,who:(item.profiles&&item.profiles.full_name)||"—",
    what:translate("proje oluşturdu"),det:item.name||""});
   for(const item of dataRequests||[])rows.push({t:item.created_at,who:item.email||"—",
    what:translate("veri talebi"),det:translateValue(item.status||"")||"—"});
   for(const item of reportRequests||[])rows.push({t:item.created_at,who:"—",
    what:translate("rapor yayını istedi"),det:"park #"+item.park_id+" · "+(translateValue(item.status||"")||"—")});
   rows.sort((a,b)=>String(b.t||"").localeCompare(String(a.t||"")));
   return rows;
  }
  return Object.freeze({build});
 }
};
