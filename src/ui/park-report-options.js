"use strict";
(function(root){
 function render(element,linked,pending,escape){
  if(!element)return;
  const option=(value,label)=>`<option value="${escape(value)}">${escape(label)}</option>`;
  element.innerHTML=(linked||[]).map(park=>option(String(park.park_id),"🌳 "+park.park_name)).join("")
   +(pending||[]).map(park=>option("proj:"+park.park_name,"⚠ "+park.park_name+" (park yok)")).join("")
   ||'<option value="">—</option>';
 }
 root.DG_PARK_REPORT_OPTIONS_UI=Object.freeze({render});
})(window);
