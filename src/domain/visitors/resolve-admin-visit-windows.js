"use strict";

/* Resolve the existing local-day and rolling-seven-day query boundaries. */
window.DG_RESOLVE_ADMIN_VISIT_WINDOWS={
  resolve(now){
    const today=new Date(now);
    today.setHours(0,0,0,0);
    return Object.freeze({today:today.toISOString(),sevenDays:new Date(now-7*86400000).toISOString()});
  }
};
