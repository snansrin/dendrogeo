"use strict";

/* Keep the data-request form declarative and hand off to its legacy workflow. */
(function(root){
 function bind({document}){
  if(root._dgDataRequestActionsBound)return;
  root._dgDataRequestActionsBound=true;
  document.addEventListener("change",event=>{
   const element=event.target?.closest?.('[data-dg-data-request-action]');
   if(!element)return;
   if(element.dataset.dgDataRequestAction==="country")root.reqCountryChanged();
   if(element.dataset.dgDataRequestAction==="city")root.reqCityChanged();
  });
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-data-request-action="submit"]');
   if(element)root.sendDataRequest();
  });
 }
 root.DG_DATA_REQUEST_ACTIONS=Object.freeze({bind});
})(window);

window.DG_DATA_REQUEST_ACTIONS.bind({document});
