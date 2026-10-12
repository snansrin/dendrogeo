"use strict";

/* Render the transient visitor activity timeline without owning its data. */
(function(root){
 function render(box,events,{locale="tr-TR",translate=value=>value,escape=value=>String(value)}={}){
  if(!box)return;
  if(!events.length){box.textContent=translate("—");return;}
  box.innerHTML=events.map(event=>{
   const time=new Date(event.t).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit",second:"2-digit"});
   return '<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);font-size:.82rem">'+
    '<span class="mono" style="color:var(--mut);flex:0 0 auto">'+time+'</span>'+ 
    '<b style="flex:0 0 auto">'+escape(event.who)+'</b>'+ 
    '<span>'+escape(event.k)+(event.d?' <span style="color:var(--mut)">· '+escape(event.d)+'</span>':"")+'</span></div>';
  }).join("");
 }
 root.DG_VISITOR_ACTIVITY_FEED_UI=Object.freeze({render});
})(window);
