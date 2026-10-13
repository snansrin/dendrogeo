"use strict";

/* Render the established GPS status and retry controls without changing copy. */
window.DG_MEASUREMENT_GPS_STATUS_UI={
  show(message,isError,ports){
    const state=ports.element("gpsState");
    if(state){state.textContent=message;state.className="alert "+(isError?"err":"info");}
    if(!isError)return;
    ports.setBusy(false);
    const button=ports.element("gpsBtn");
    if(button){button.classList.remove("is-active");button.textContent="📡 Konumu Tekrar Dene";button.dataset.oldText=button.textContent;}
    const badge=ports.element("gpsBadge");
    if(badge){badge.textContent="konum kapalı";badge.className="dg-png-badge ";}
    ports.notify(message);
  }
};
