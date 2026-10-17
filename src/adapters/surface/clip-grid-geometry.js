"use strict";

/* Keep successful results; recover known numerical topology failures for grids only. */
window.DG_CLIP_GRID_GEOMETRY={
  create({run,clean}){
    let integerMode=false;
    return(operation,...geometries)=>integerMode
      ?clean(window.DG_INTEGER_GRID_CLIP.clip(operation,geometries.map(clean),{library:window.ClipperLib}))
      :window.DG_CLIP_GRID_GEOMETRY.clip(operation,geometries,{run,clean,onFallback:()=>{integerMode=true;}});
  },
  clip(operation,geometries,{run,clean,onFallback}){
    const recoverable=error=>/Unable to find segment[\s\S]*SweepLine tree|Unable to complete output ring starting at[\s\S]*Last matching segment found ends at/.test(String(error?.message));
    const inputs=geometries.map(value=>clean(value));
    try{return clean(run(operation,...inputs));}
    catch(error){
      if(!recoverable(error))throw error;
      // Inputs are already rounded to 0.001 m. Changing units does not move a
      // boundary or relax an exclusion. Never return the uncut input on failure.
      const map=(geometry,convert)=>geometry.map(polygon=>polygon.map(ring=>ring.map(point=>point.map(convert))));
      const integers=inputs.map(geometry=>map(geometry,value=>{
        const integer=Math.round(value*1000);
        if(!Number.isSafeInteger(integer))throw error;
        return integer;
      }));
      try{return clean(map(run(operation,...integers),value=>value/1000));}
      catch(retryError){
        if(!recoverable(retryError)||!window.DG_INTEGER_GRID_CLIP||!window.ClipperLib)throw retryError;
        onFallback?.();
        return clean(window.DG_INTEGER_GRID_CLIP.clip(operation,inputs,{library:window.ClipperLib}));
      }
    }
  }
};
