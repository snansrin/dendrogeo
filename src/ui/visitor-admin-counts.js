"use strict";

/* Render administrator visit totals into the existing count fields. */
window.DG_VISITOR_ADMIN_COUNTS_UI={
  total(element,value){element.textContent=value;},
  today(element,value){element.textContent=value;},
  sevenDays(element,value){element.textContent=value;},
  failed(element){element.textContent="—";}
};
