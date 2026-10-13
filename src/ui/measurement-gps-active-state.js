"use strict";

/* Preserve the established active state for the GPS button and inline status. */
window.DG_MEASUREMENT_GPS_ACTIVE_STATE_UI={
  render(view,element){
    const state=element("gpsState");if(state){state.textContent="GPS aktif";state.className="alert ok";}
    const button=element("gpsBtn");if(button){button.textContent="GPS aktif";button.dataset.oldText="GPS aktif";button.classList.add("is-active");}
    const badge=element("gpsBadge");if(badge){badge.textContent=view.badgeText;badge.className=view.badgeClass;}
  }
};
