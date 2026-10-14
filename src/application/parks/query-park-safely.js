"use strict";
/* Backfill may continue after a lookup error, while preserving its diagnostic. */
window.DG_QUERY_PARK_SAFELY={async query(lat,lon,radius,{queryPark,warn}){try{return await queryPark(lat,lon,radius);}catch(error){warn(radius,error);return null;}}};
