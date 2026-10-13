"use strict";

/* Accept only the established cell sizes and bounded safety clearance. */
window.DG_VALIDATE_SURFACE_GRID_OPTIONS={
  validate(data){
    const size=Number(data.size),clearance=Number(data.clearance);
    if(![10,20,50].includes(size)||!Number.isFinite(clearance)||clearance<1||clearance>20)throw Error('Grid boyutu veya güvenlik mesafesi geçersiz.');
    return{size,clearance,epsg:data.epsg};
  }
};
