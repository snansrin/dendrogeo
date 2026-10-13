"use strict";

/* Change only among the editor's supported base map layers. */
window.DG_SELECT_SURFACE_BASEMAP={
  select({state,type,switchLayer,allowed=["osm","sat","topo"]}){
    if(!allowed.includes(type))return false;state.base=type;switchLayer(type);return true;
  }
};
