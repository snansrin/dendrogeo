"use strict";

/* Keep the usual result; recover SweepLine round-off on the same millimetre lattice. */
window.DG_CLIP_GRID_GEOMETRY={
  create({run,clean}){
    let integerMode=false;
    return(operation,...geometries)=>integerMode
      ?clean(window.DG_INTEGER_GRID_CLIP.clip(operation,geometries.map(clean),{library:window.ClipperLib}))
      :window.DG_CLIP_GRID_GEOMETRY.clip(operation,geometries,{run,clean,onFallback:()=>{integerMode=true;}});
  },
  clip(operation,geometries,{run,clean,onFallback}){
    const inputs=geometries.map(value=>clean(value));
    try{return clean(run(operation,...inputs));}
    catch(error){
      if(!/Unable to find segment[\s\S]*SweepLine tree/.test(String(error?.message)))throw error;
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
        if(!/Unable to find segment[\s\S]*SweepLine tree/.test(String(retryError?.message))||!window.DG_INTEGER_GRID_CLIP||!window.ClipperLib)throw retryError;
        onFallback?.();
        return clean(window.DG_INTEGER_GRID_CLIP.clip(operation,inputs,{library:window.ClipperLib}));
      }
    }
  }
};
