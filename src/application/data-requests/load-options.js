"use strict";
window.DG_LOAD_DATA_REQUEST_OPTIONS={
 async execute({load,apply,warn,fillCountries,refreshCities}){
  try{
   const {measurements,projects}=await load();
   apply(measurements.data||[],projects.data||[]);
   warn(measurements);
   fillCountries();refreshCities();
  }catch(error){}
 }
};
