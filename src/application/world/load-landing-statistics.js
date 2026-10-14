"use strict";
/* Independent panels remain usable when public summary evidence is partial. */
window.DG_LOAD_LANDING_STATISTICS={async load({load,renderTotals,renderCountries,renderCities,onError}){
 try{const result=await load();if(result.global?.data)renderTotals(result.global.data);if(result.countries)renderCountries(result.countries);if(result.cities)renderCities(result.cities);if(result.errors?.length)onError(result.errors);return result;}catch(error){onError([error]);return null;}
}};
