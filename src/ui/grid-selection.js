"use strict";
/* Coordinate selection, cell styles and summary through supplied view ports. */
(function(root){
  function createGridSelection({getCells,getSelection,getLayer,resolveStyle,countStates,updateSummary}){
    function refreshSelectionSummary(){
      const {measured,empty}=countStates(getCells());
      updateSummary(measured,empty);
    }
    function toggleGridCell(cellId,rect){
      const selected=getSelection();
      const active=!selected.has(cellId);
      if(active)selected.add(cellId);else selected.delete(cellId);
      const cell=getCells().find(candidate=>candidate.id===cellId);
      if(cell)rect.setStyle(resolveStyle(cell,active));
      refreshSelectionSummary();
    }
    function clearGridSelection(){
      getSelection().clear();
      const layer=getLayer();
      if(layer)layer.eachLayer(item=>{
        if(item.setStyle&&item._cellId){
          const cell=getCells().find(candidate=>candidate.id===item._cellId);
          if(cell)item.setStyle(resolveStyle(cell,false));
        }
      });
      refreshSelectionSummary();
    }
    return Object.freeze({toggle:toggleGridCell,clear:clearGridSelection});
  }
  root.DG_GRID_SELECTION_UI=Object.freeze({create:createGridSelection});
})(window);
