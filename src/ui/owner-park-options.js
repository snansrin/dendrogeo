"use strict";
(function(root){
 function render(parks,selected,escape){
  const keep=(parks||[]).some(park=>String(park.id)===String(selected));
  return{
   html:(parks||[]).map(park=>`<option value="${park.id}">${escape(park.name)}${park.city?" · "+escape(park.city):""}</option>`).join(""),
   selected:keep?String(selected):null
  };
 }
 function setVisibility(element,visible){if(element)element.style.display=visible?"":"none";}
 function setEmpty(select,label){if(select)select.innerHTML=`<option value="">${label}</option>`;}
 function setOptions(select,parks,selected,escape){
  if(!select)return;
  const options=render(parks,selected,escape);select.innerHTML=options.html;
  if(options.selected!=null)select.value=options.selected;
 }
 root.DG_OWNER_PARK_OPTIONS_UI=Object.freeze({render,setVisibility,setEmpty,setOptions});
})(window);
