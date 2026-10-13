"use strict";

window.DG_SHOW_WAYPOINT_LOAD_ERROR={
  show({error,notify,translate}){notify(translate("Waypoint listesi alınamadı:")+" "+error.message,"err");}
};
