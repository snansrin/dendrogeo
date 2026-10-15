"use strict";

/* Render administrator visit totals into the existing count fields. */
window.DG_VISITOR_ADMIN_COUNTS_UI={
  update(document,id,value){const element=document.getElementById(id);if(element)element.textContent=value;},
  total(element,value){element.textContent=value;},
  today(element,value){element.textContent=value;},
  sevenDays(element,value){element.textContent=value;},
  failed(element){element.textContent="—";}
};
