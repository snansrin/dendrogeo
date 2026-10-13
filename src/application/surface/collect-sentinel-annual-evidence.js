"use strict";

/* Add valid distinct-date seasonal water and vegetation evidence per cell. */
window.DG_COLLECT_SENTINEL_ANNUAL_EVIDENCE={
  collect({cells,reads,indices,validClasses,item,datetime,reflectance,evidence,waterMax,vegMax}){
    let used=0;
    for(let cellIndex=0;cellIndex<cells.length;cellIndex++){
      const sclIndex=indices.SCL[cellIndex],greenIndex=indices.B03[cellIndex],redIndex=indices.B04[cellIndex],nirIndex=indices.B08[cellIndex],swirIndex=indices.B11[cellIndex];
      if(sclIndex===null||greenIndex===null||redIndex===null||nirIndex===null||swirIndex===null)continue;
      if(!validClasses.includes(Math.round(Number(reads.SCL.values[sclIndex]))))continue;
      const green=reflectance(reads.B03.values[greenIndex],item,"B03"),red=reflectance(reads.B04.values[redIndex],item,"B04");
      const nir=reflectance(reads.B08.values[nirIndex],item,"B08"),swir=reflectance(reads.B11.values[swirIndex],item,"B11");
      const valid=value=>value!==null&&Number.isFinite(value);
      if(!valid(green)||!valid(red)||!valid(nir)||!valid(swir)||green+swir<=0||nir+red<=0)continue;
      const cell=cells[cellIndex],key=cell.row+":"+cell.col;
      if(!evidence[key])evidence[key]={ndvi:[],mndwi:[],dates:new Set()};
      const entry=evidence[key];
      if(entry.dates.has(datetime))continue;
      entry.dates.add(datetime);
      const mndwi=(green-swir)/(green+swir),ndvi=(nir-red)/(nir+red);
      if(waterMax[key]===undefined||mndwi>waterMax[key])waterMax[key]=mndwi;
      entry.ndvi.push(ndvi);entry.mndwi.push(mndwi);
      if(vegMax[key]===undefined||ndvi>vegMax[key])vegMax[key]=ndvi;
      used++;
    }
    return used;
  }
};
