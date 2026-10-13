"use strict";

/* Fetch the old project-keyed data only after the primary schema is confirmed absent. */
window.DG_LOAD_LEGACY_PARK_COMPARISON={
 async execute({load,warnIfTruncated,setRows,group}){
  const{data,count}=await load(),rows=data||[];
  warnIfTruncated(data,5000,"Park karşılaştırma",count);
  setRows(rows);
  return{rows,grouped:group(rows)};
 }
};
