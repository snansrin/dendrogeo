"use strict";

/* Keep map toolbar markup declarative while preserving legacy map APIs. */
(function(root){
  function bind({document}){
    if(root._dgLiveMapControlsBound)return;
    root._dgLiveMapControlsBound=true;
    document.addEventListener("click",event=>{
      const element=event.target?.closest?.("[data-dg-map-action]");
      if(element?.dataset.dgMapAction==="toggle-park-mode")root.dgToggleParkMode();
      else if(element?.dataset.dgMapAction==="refresh")root.loadLiveMap();
    });
    document.addEventListener("change",event=>{
      const element=event.target?.closest?.("[data-dg-map-action='base-layer']");
      if(element)root.switchBaseLayer(element.value);
    });
  }
  root.DG_LIVE_MAP_CONTROLS=Object.freeze({bind});
})(window);

window.DG_LIVE_MAP_CONTROLS.bind({document});
