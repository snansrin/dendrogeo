"use strict";
/* Save the accepted detailed OSM response and its padded spatial extent. */
(function(root){
  function clearForChangedBoundary(boundary,{getCoverage,clearCoverage,clearGeometry}){
    if(getCoverage()?.boundary===boundary)return false;
    clearCoverage();
    clearGeometry();
    return true;
  }
  function commit({elements,bbox,pad,boundary,fetchedAt}){
    return {elements:elements||[],bbox:{minLat:bbox.minLat-pad,minLon:bbox.minLon-pad,maxLat:bbox.maxLat+pad,maxLon:bbox.maxLon+pad},boundary,fetchedAt};
  }
  root.DG_COMMIT_PARK_COVERAGE_SNAPSHOT=Object.freeze({clearForChangedBoundary,commit});
})(window);
