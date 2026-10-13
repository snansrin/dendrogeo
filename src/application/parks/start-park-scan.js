"use strict";
/* Coordinate the existing park discovery handoff and delayed map refresh. */
(function(root){
  function start(options,ports){
    options=options||{};
    ports.setActive(true);
    ports.setTargetProject(options.projectId||null);
    ports.setReturnTo(options.returnTo||"measure");
    if(ports.go)ports.go("map");
    if(!ports.parkMode()&&ports.toggleParkMode)ports.toggleParkMode();
    ports.schedule(()=>{
      const map=ports.map();
      if(map&&map.invalidateSize)map.invalidateSize();
      ports.focusTarget();
      ports.render();
      const card=ports.card();
      if(card&&card.scrollIntoView)card.scrollIntoView({behavior:"smooth",block:"start"});
    },200);
    ports.notify("🌳 Park algılama: haritada parkın içine tıkla","info","🌳");
  }
  root.DG_START_PARK_SCAN=Object.freeze({start});
})(window);
