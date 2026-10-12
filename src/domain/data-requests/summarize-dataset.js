"use strict";

/* Preserve the reply's existing totals; the caller supplies approved, filtered rows. */
(function(root){
 function summarize(rows){
  return{
   count:rows.length,
   totalCarbon:rows.reduce((total,row)=>total+(row.carbon_kg||0),0),
   countries:new Set(rows.map(row=>row.country).filter(Boolean)),
   cities:new Set(rows.map(row=>row.city).filter(Boolean))
  };
 }
 root.DG_DATA_REQUEST_DATASET_SUMMARY=Object.freeze({summarize});
})(window);
