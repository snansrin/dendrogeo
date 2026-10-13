"use strict";
/* Derive the scan card's current step from the registered and candidate parks. */
(function(root){
  function select(park,candidate){return park?3:(candidate?2:1);}
  root.DG_SELECT_PARK_SCAN_STEP=Object.freeze({select});
})(window);
