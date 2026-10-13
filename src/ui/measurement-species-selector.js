"use strict";

/* Canonical Turkish values stay in the form while labels follow the active language. */
window.DG_MEASUREMENT_SPECIES_SELECTOR={
  fill({getElement,speciesData,turkishLabels,translate}){
    const groupValue=getElement("mGroup").value,species=getElement("mSpecies");
    getElement("latinName").textContent="";
    const group=speciesData&&speciesData[groupValue]?groupValue:((turkishLabels&&turkishLabels[groupValue])||groupValue);
    if(!group||!(speciesData&&speciesData[group])){species.disabled=true;species.innerHTML='<option value="">Önce grup seçin</option>';getElement("latinName").textContent="";return;}
    species.disabled=false;
    species.innerHTML='<option value="">Seç</option>'+(speciesData[group]||[]).slice().sort((a,b)=>String(a.tr).localeCompare(String(b.tr),"tr")).map(item=>`<option value="${item.tr}">${translate(item.tr)}${item.lat&&item.lat!=="—"?" · "+item.lat:""}</option>`).join("");
    getElement("latinName").textContent="";
  },
  showLatin({getElement,latinNames}){
    const species=getElement("mSpecies").value;
    getElement("latinName").textContent=(latinNames[species]&&latinNames[species]!=="—")?"🔬 "+latinNames[species]:"";
  }
};
