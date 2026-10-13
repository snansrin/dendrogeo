"use strict";
/* Restrict fetched coverage geometry to the selected park and normalize blockers. */
(function(root){
  function filter({waterRings,waterLines,imperviousRings,imperviousLines,gridBlockLines,park,bounds,clearance,isRingTouching,lineTouches}){
    return {
      waterRings:waterRings.filter(ring=>isRingTouching(ring,park,bounds)),
      waterLines:waterLines.filter(line=>lineTouches(line,park,bounds)),
      imperviousRings:imperviousRings.filter(ring=>isRingTouching(ring,park,bounds)),
      imperviousLines:imperviousLines.filter(line=>lineTouches(line.pts,park,bounds)),
      gridBlockLines:(gridBlockLines||[])
        .map(line=>Array.isArray(line)?{pts:line,w:clearance}:line)
        .filter(line=>line&&Array.isArray(line.pts)&&line.pts.length>=2&&lineTouches(line.pts,park,bounds)),
    };
  }
  root.DG_FILTER_PARK_COVERAGE_TO_BOUNDARY=Object.freeze({filter});
})(window);
