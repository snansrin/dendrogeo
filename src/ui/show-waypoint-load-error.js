"use strict";

window.DG_SHOW_WAYPOINT_LOAD_ERROR={
  show({error,notify,translate}){notify(translate("Ölçüm noktası listesi alınamadı:")+" "+error.message,"err");}
};
