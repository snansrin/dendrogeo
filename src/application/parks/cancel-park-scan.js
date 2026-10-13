"use strict";
/* Clear the discovery handoff and return to the originating view. */
(function(root){
  function cancel(ports){
    ports.setActive(false);
    ports.setTargetProject(null);
    const destination=ports.returnTo();
    ports.setReturnTo(null);
    ports.render();
    if(destination&&ports.go)ports.go(destination);
    return destination||null;
  }
  root.DG_CANCEL_PARK_SCAN=Object.freeze({cancel});
})(window);
