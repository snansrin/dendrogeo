"use strict";

window.DG_OPEN_USER_PUBLICATION_PANEL = (() => {
  async function execute(projectId, ports) {
    const box = ports.getBox();
    if (!box) return;
    if (!ports.isAuthenticated()) return ports.onUnauthenticated();

    const project = ports.findProject(projectId);
    if (!project) return ports.onMissingProject();
    if (!project.park_id) return ports.onUnlinkedProject();

    ports.stopPolling();
    ports.selectProject(project);
    box.style.display = "";
    box.innerHTML = '<div class="dg-tree-meta">⏳ Rapor durumu yükleniyor…</div>';
    if (box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    await ports.refresh();
  }

  return Object.freeze({ execute });
})();
