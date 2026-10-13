"use strict";

/* Render the current fix and established quality details into the field form. */
window.DG_MEASUREMENT_GPS_READOUT_UI={
  render(view,element){
    const accuracy=element("gpsAcc"),latitude=element("gLat"),longitude=element("gLon"),altitude=element("gAlt"),quality=element("gQ"),ring=element("gpsRing");
    if(accuracy)accuracy.textContent=view.accuracy;
    if(latitude)latitude.textContent=view.latitude;
    if(longitude)longitude.textContent=view.longitude;
    if(altitude)altitude.textContent=view.altitude;
    if(quality)quality.textContent=view.quality;
    if(ring)ring.className=view.ringClass;
  }
};
