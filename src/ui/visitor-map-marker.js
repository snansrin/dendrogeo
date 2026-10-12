"use strict";

/* Produce the existing Leaflet marker presentation without owning map state. */
(function(root){
 function build(row,{color="#2b6cb0",viewLabels={},translate=value=>value,escape=value=>String(value)}={}){
  const p=row.p;
  const initial=String(p.n||"?").trim().slice(0,1).toLocaleUpperCase("tr-TR");
  const label=viewLabels[p.v]||p.v||"";
  const age=row.age<60?row.age+" "+translate("sn"):Math.round(row.age/60)+" "+translate("dk");
  return{
   icon:{className:"",html:'<div style="width:20px;height:20px;border-radius:50%;background:'+color+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">'+escape(initial)+'</div>',iconSize:[20,20],iconAnchor:[10,10]},
   tooltip:"<b>"+escape(p.n||"?")+"</b><br>"+escape(translate(label))+"<br>"+translate("son konum")+": "+age+" "+translate("önce"),
   tooltipOptions:{direction:"top",offset:[0,-12]}
  };
 }
 root.DG_VISITOR_MAP_MARKER_UI=Object.freeze({build});
})(window);
