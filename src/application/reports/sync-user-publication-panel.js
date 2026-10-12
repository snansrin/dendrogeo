"use strict";

window.DG_SYNC_USER_PUBLICATION_PANEL = (() => {
  function execute(state, list, close) {
    if (!state.projectId) return;
    const projects = Array.isArray(list) ? list : [];
    if (!projects.some(project => Number(project.id) === state.projectId)) close();
  }

  return Object.freeze({ execute });
})();
