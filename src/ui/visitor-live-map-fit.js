"use strict";

/* Apply the established single-user and multi-user live-map framing rules. */
window.DG_VISITOR_LIVE_MAP_FIT_UI={
  apply({map,leaflet,located,shouldFit,follow,fit}){
    try{
      if(shouldFit&&located.length===1)map.setView([located[0].p.la,located[0].p.lo],13);
      else if(shouldFit&&located.length>1)map.fitBounds(leaflet.latLngBounds(located.map(row=>[row.p.la,row.p.lo])).pad(0.35),{maxZoom:14});
      return located.length?true:fit;
    }catch(_){return fit;}
  }
};
