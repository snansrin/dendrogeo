"use strict";

/* Render one escaped, keyboard-inert Presence marker with its age tooltip. */
window.DG_RENDER_PARK_LIVE_COLLABORATOR_MARKER={
  render({layer,leaflet,member,view,escape,translate}){
    const icon=leaflet.divIcon({className:"",html:'<div style="width:18px;height:18px;border-radius:50%;background:'+view.color+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">'+escape(view.initial)+'</div>',iconSize:[18,18],iconAnchor:[9,9]});
    leaflet.marker([view.lat,view.lon],{icon,interactive:true,keyboard:false,zIndexOffset:600}).addTo(layer)
      .bindTooltip("<b>"+escape(view.name)+"</b><br>"+translate("son konum")+": "+view.ageLabel+" "+translate("önce"),{direction:"top",offset:[0,-11]});
  }
};
