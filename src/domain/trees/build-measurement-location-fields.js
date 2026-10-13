"use strict";

/* Normalize the established GPS and reverse-geocode values for a new row. */
window.DG_BUILD_MEASUREMENT_LOCATION_FIELDS={
  build({fix,geocode}){
    return{lat:fix.latitude,lon:fix.longitude,accuracy_m:fix.accuracy,altitude_m:fix.altitude,country:geocode?geocode.country:"Bilinmiyor",city:geocode?geocode.city:"Bilinmiyor"};
  }
};
