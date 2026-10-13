"use strict";

/* Coordinate the owner-only visitor view while keeping DOM and map ports injected. */
window.DG_RENDER_OWNER_LIVE_VISITOR_VIEW={
 render({allowed,paused,hidden,view,readRows,filterRows,summarize,hasLocation,updateCounts,renderPanel,renderFeed,drawMap}){
  if(!allowed||paused||hidden||(view&&view!=="visitors"))return null;
  const all=readRows(),rows=filterRows(all),counts=summarize(all,hasLocation);
  updateCounts(counts);
  renderPanel(rows,all.length);
  renderFeed(rows);
  drawMap(rows);
  return{all,rows,counts};
 }
};
