"use strict";
(function(root){
 async function run(rows,{isValidCoordinate,reverse,update,wait}){
  let done=0;
  for(const row of (rows||[])){
   if(!isValidCoordinate(row.lat,row.lon))continue;
   const geo=await reverse(row.lat,row.lon);
   if(geo&&(geo.city!==row.city||geo.country!==row.country)){
    await update(row.id,{city:geo.city,country:geo.country});
    done++;
   }
   await wait(1100);
  }
  return done;
 }
 root.DG_RE_GEOCODE_MEASUREMENTS=Object.freeze({run});
})(window);
