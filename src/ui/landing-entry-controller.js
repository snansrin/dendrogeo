"use strict";
/* Public stats never delay the independently lazy landing map. */
window.DG_LANDING_ENTRY_CONTROLLER={activate({element,mapWhenVisible,hasMap,loadMarkers,markMarkersPending,refreshStatistics,trackVisit}){element('landing').style.display='block';element('shell').style.display='none';mapWhenVisible();if(hasMap())loadMarkers();else markMarkersPending();void refreshStatistics();trackVisit();}};
