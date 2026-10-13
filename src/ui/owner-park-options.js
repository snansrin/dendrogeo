"use strict";
(function(root){
 function render(parks,selected,escape){
  const keep=(parks||[]).some(park=>String(park.id)===String(selected));
  return{
   html:(parks||[]).map(park=>`<option value="${park.id}">${escape(park.name)}${park.city?" · "+escape(park.city):""}</option>`).join(""),
   selected:keep?String(selected):null
  };
 }
 root.DG_OWNER_PARK_OPTIONS_UI=Object.freeze({render});
})(window);
