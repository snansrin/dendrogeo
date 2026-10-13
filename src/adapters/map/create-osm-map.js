"use strict";

window.DG_CREATE_OSM_MAP={
  create({leaflet,container,center,zoom}){return leaflet.map(container).setView(center,zoom);}
};
