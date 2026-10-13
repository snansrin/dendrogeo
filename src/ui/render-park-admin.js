"use strict";

/* Compose park-admin state, overview counts and the existing renderer. */
window.DG_RENDER_PARK_ADMIN_UI={
  render({state,element,projects,measurements,buildOverview,renderRows,normalizeLoose,normalizeName,formatHectares,distance,escapeHTML,translate,translateFormat,translatePlain}){
    const box=element("parkAdminBox");
    if(!box)return;
    const current=state.getState();
    const rows=current.rows;
    const context={projects:projects||[],measurements:measurements||[]};
    state.setState({lastContext:context});
    const overview=buildOverview({rows,projects,measurements,showEmpty:current.showEmpty,normalizeLoose,normalizeName});
    renderRows({element:box,rows,overview,showEmpty:current.showEmpty,formatHectares,distance,escapeHTML,translate,translateFormat,translatePlain});
  }
};
