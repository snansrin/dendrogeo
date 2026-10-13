"use strict";

/* Update field GPS details, current marker and dependent navigation in order. */
window.DG_REFRESH_MEASUREMENT_GPS_VIEW={
  refresh(ports){
    const coords=ports.getGPS();if(!coords)return;
    const view=ports.format(coords);
    ports.renderReadout(view);
    ports.renderActive(view);
    ports.updateMarker(coords);
    ports.drawNavigation();
    ports.suggestPoint();
    return view;
  }
};
