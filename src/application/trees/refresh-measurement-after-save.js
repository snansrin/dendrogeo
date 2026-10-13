"use strict";

/* Refresh only the views affected by the existing online/offline save path. */
window.DG_REFRESH_MEASUREMENT_AFTER_SAVE={
  offline({wasEdit,reset,autoFill,loadDashboard,loadRecords}){
    reset();if(!wasEdit)autoFill();loadDashboard();loadRecords();
  },
  online({wasEdit,reset,autoFill,loadDashboard,loadRecords,loadWaypoints}){
    reset();loadDashboard();loadRecords();loadWaypoints();if(!wasEdit)autoFill();
  }
};
