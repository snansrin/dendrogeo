"use strict";

/* Present connection status and filtered visitor rows in the existing panel. */
window.DG_VISITOR_LIVE_PANEL_UI={
 render({statusElement,state,rows,allCount,rosterElement,viewLabels,actionLabels,hasLocation,deviceLabel,translate,escape,connectionStatus,roster,focus}){
  if(statusElement)connectionStatus.render(statusElement,state,rows.length,allCount);
  if(rosterElement)roster.render(rosterElement,rows,{state,allCount,viewLabels,actionLabels,hasLocation,deviceLabel,translate,escape,focus});
 }
};
