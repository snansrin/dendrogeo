"use strict";
(function(root){
 function render(select,options,escape){
  if(!select)return;
  const current=select.value;
  select.innerHTML='<option value="">Tümü</option>'+options.map(option=>{
   const object=typeof option==="object",value=object?option.v:option,label=object?option.label:option;
   return `<option value="${escape(value)}"${value===current?" selected":""}>${escape(label)}</option>`;
  }).join("");
  if(select.value!==current)select.value="";
 }
 root.DG_FILL_ADMIN_EXPORT_SELECT=Object.freeze({render});
})(window);
