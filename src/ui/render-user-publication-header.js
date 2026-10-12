"use strict";

window.DG_RENDER_USER_PUBLICATION_HEADER = (() => {
  function render(state, view, close, escape) {
    const note = view.note ? '<span class="dg-tree-meta">' + escape(view.note) + "</span>" : "";
    const url = view.url ? '<div class="dg-tree-meta" style="margin-top:8px">Kalıcı bağlantı: <span class="mono">' + escape(view.url) + "</span>"
      + (view.publication && view.publication.finished_at ? " · yayın " + String(view.publication.finished_at).slice(0, 10) : "") + "</div>" : "";
    return '<div class="shead" style="margin-bottom:10px"><span class="no">📄</span><h2 style="font-size:1.15rem">Park Raporu — '
      + escape(state.parkName) + '</h2><span class="rule"></span>' + close + "</div>"
      + '<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">' + view.badge + note + "</div>" + url;
  }

  return Object.freeze({ render });
})();
