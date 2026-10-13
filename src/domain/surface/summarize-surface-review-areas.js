"use strict";
/* Summarize reviewed surface-part areas once for the current resolved parts. */
(function(root){
  function summarize({record,geometry,parts,memo,rasterAreas,summarizeParts}){
    if(!record||!geometry)return null;
    if(!memo)return summarizeParts(rasterAreas,parts);
    return memo.areas||(memo.areas=summarizeParts(rasterAreas,parts));
  }
  root.DG_SUMMARIZE_SURFACE_REVIEW_AREAS=Object.freeze({summarize});
})(window);
