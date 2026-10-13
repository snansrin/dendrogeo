"use strict";

/* Keep only valid same-day spectra after the SCL mask and all band checks. */
window.DG_COLLECT_SENTINEL_SCENE_OBSERVATIONS={
  collect({cells,scl,bands,indices,validClasses,item,datetime,reflectance,accumulator}){
    let used=0;
    for(let cellIndex=0;cellIndex<cells.length;cellIndex++){
      const sclIndex=indices.SCL[cellIndex];
      if(sclIndex===null)continue;
      if(!validClasses.includes(Math.round(Number(scl.values[sclIndex]))))continue;
      const values={};let valid=true;
      for(const band of ["B03","B04","B08","B11"]){
        const index=indices[band][cellIndex];
        if(index===null){valid=false;break;}
        const value=reflectance(bands[band].values[index],item,band);
        if(value===null){valid=false;break;}
        values[band]=value;
      }
      if(!valid)continue;
      const cell=cells[cellIndex],key=cell.row+":"+cell.col;
      if(!accumulator[key])accumulator[key]={b03:[],b04:[],b08:[],b11:[],mndwis:[],ndvis:[],ndbis:[],dates:new Set()};
      const entry=accumulator[key];
      if(entry.dates.has(datetime))continue;
      entry.dates.add(datetime);
      entry.b03.push(values.B03);entry.b04.push(values.B04);entry.b08.push(values.B08);entry.b11.push(values.B11);
      const green=values.B03,shortwave=values.B11;
      if(green+shortwave>0)entry.mndwis.push((green-shortwave)/(green+shortwave));
      const red=values.B04,nir=values.B08;
      if(red+nir>0)entry.ndvis.push((nir-red)/(nir+red));
      if(values.B11+values.B08>0)entry.ndbis.push((values.B11-values.B08)/(values.B11+values.B08));
      used++;
    }
    return used;
  }
};
