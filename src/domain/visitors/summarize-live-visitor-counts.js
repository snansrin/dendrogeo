"use strict";

/* Count the currently visible presence roster and valid live locations. */
window.DG_SUMMARIZE_LIVE_VISITOR_COUNTS={
 summarize(rows,hasLocation){
  return{online:rows.length,located:rows.reduce((count,row)=>count+(hasLocation(row.p)?1:0),0)};
 }
};
