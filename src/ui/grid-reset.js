"use strict";
/* Clear the current grid view while retaining the supplied state containers. */
(function(root){
  function clearGridView({map,renderer,gridLayer,waypointLayer,cells,selection,rendererCleared,gridCleared,waypointsCleared,getSummary,getGridControl,getWaypointControl}){
    if(renderer&&map)map.removeLayer(renderer);
    rendererCleared();
    if(gridLayer&&map){map.removeLayer(gridLayer);gridCleared();}
    if(waypointLayer&&map){map.removeLayer(waypointLayer);waypointsCleared();}
    cells.length=0;
    selection.clear();
    const summary=getSummary();
    if(summary){summary.innerHTML="";summary.style.display="none";}
    const gridControl=getGridControl();
    if(gridControl)gridControl.checked=true;
    const waypointControl=getWaypointControl();
    if(waypointControl)waypointControl.checked=true;
  }
  root.DG_GRID_RESET_UI=Object.freeze({clear:clearGridView});
})(window);
