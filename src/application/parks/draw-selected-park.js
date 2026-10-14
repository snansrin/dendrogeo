"use strict";
/* Registry and coverage remain parallel; late work cannot redraw another park. */
window.DG_DRAW_SELECTED_PARK={async draw(park,ports){
 ports.setSelectedArea(park);ports.clearPark();ports.clearGrid();const registration=Promise.resolve(ports.registerPark(park)),geometry=ports.normalize(park);
 // Discarded work is handled, while an awaited registration still propagates errors.
 registration.catch(()=>{});
 if(!geometry)return ports.invalidGeometry(park);const {outer,holes}=geometry;ports.setGeometry(outer,holes);ports.renderBoundary(outer,holes);
 const covered=await ports.loadCoverage();if(!ports.isCurrent(outer))return;if(!covered)ports.coverageUnavailable();ports.fitBoundary(outer,holes);const hectares=ports.areaHa().toFixed(1),row=await registration;if(!ports.isCurrent(outer))return;
 return ports.present({park,row,hectares});
}};
