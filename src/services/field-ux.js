"use strict";
/* Field UX is implemented by its owning modules: map.js, measure.js,
 * lc-sens.js and lc-review.js. Keep this lazy-loader compatibility entry
 * without wrapping their functions: wrappers previously repeated geometry
 * work, replaced the iPhone wording and overwrote the compact waypoint rows. */
window.DG_FIELD_UX={version:"2026-10-04.1",testPage:(n,page,size)=>({start:Math.max(0,page)*size,end:Math.min(n,(Math.max(0,page)+1)*size),pages:Math.max(1,Math.ceil(n/size))})};
window.dgWpPage=delta=>dgWaypointPage(delta);
