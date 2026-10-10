"use strict";
/* Build the grid view with the existing geometry, style and selection ports. */
(function(root){
function renderGridLayer({leaflet:L,map,previousLayer:GRID_LAYER,previousRenderer:DG_GRID_RENDERER,cells:GRID_CELLS,selection:SELECTED_CELLS,resolveStyle,resolveShape,countStates,translateFormat:_tgrf,onSelect:toggleCellSelection,onCreated,updateSummary:updateGridSummary}){
  if(
    GRID_LAYER &&
    map
  ){
    map.removeLayer(
      GRID_LAYER
    );
  }

  if(DG_GRID_RENDERER&&map)map.removeLayer(DG_GRID_RENDERER);
  GRID_LAYER=L.layerGroup().addTo(map);DG_GRID_RENDERER=L.canvas({padding:.1});
  onCreated({layer:GRID_LAYER,renderer:DG_GRID_RENDERER});

  const {measured:g,empty:r0}=countStates(GRID_CELLS);

  GRID_CELLS.forEach(cell=>{
    const style=resolveStyle(
      cell,
      SELECTED_CELLS.has(cell.id)
    );

    const shape=resolveShape(cell);
    const rect=L.polygon(shape,
        {
          renderer:DG_GRID_RENDERER,
          ...style,
          interactive:true
        }
      ).addTo(
        GRID_LAYER
      );

    rect._cellId=
      cell.id;

    rect.on(
      "click",
      e=>{
        L.DomEvent.stopPropagation(
          e
        );

        toggleCellSelection(
          cell.id,
          rect
        );
      }
    );

    rect.bindTooltip(
      _tgrf("Hücre {id} · {n} ölçüm",{id:cell.id,n:cell.n}),
      {
        sticky:true
      }
    );
  });

  updateGridSummary(
    g,
    r0
  );
}

root.DG_GRID_LAYER_UI=Object.freeze({render:renderGridLayer});
})(window);
