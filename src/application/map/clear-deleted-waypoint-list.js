"use strict";

window.DG_CLEAR_DELETED_WAYPOINT_LIST={
  clear({setTarget,setWaypoints,notify,refresh}){setTarget(null);setWaypoints([]);notify("✓ Liste tamamen silindi. Yeni CSV yükleyebilirsiniz.");refresh();}
};
