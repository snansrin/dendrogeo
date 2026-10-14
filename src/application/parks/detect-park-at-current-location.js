"use strict";
/* GPS acquisition is a port; absence cannot be mistaken for a park detection. */
window.DG_DETECT_PARK_AT_CURRENT_LOCATION={detect({gps,notifyMissing,startGps,detectAt}){
 if(!gps){notifyMissing();startGps();return Promise.resolve(null);}return detectAt(gps.latitude,gps.longitude);
}};
