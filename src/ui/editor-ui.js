/* Shared map-editor presentation primitives. These helpers only render UI;
 * they do not own map state, editing decisions, or analysis behavior. */
(() => {
  const paths = {
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    view: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    brush: '<path d="m14 6 4 4M4 20c3.5 0 5-1.5 5-4 0-1.7 1.3-3 3-3l6-6a2.8 2.8 0 0 0-4-4l-6 6c0 1.7-1.3 3-3 3-2.5 0-4 1.5-4 5v3Z"/>',
    boundary: '<path d="m4 5 6-2 5 3 5-2v15l-5 2-5-3-6 2V5Z"/><path d="m10 3v15m5-12v15"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.9h-3l-.3-1.9a8 8 0 0 1-1.8-1l-1.7.7-1.5-2.6 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.5-2.6 1.7.7a8 8 0 0 1 1.8-1l.3-1.9h3l.3 1.9a8 8 0 0 1 1.8 1l1.7-.7 1.5 2.6-1.4 1.1a7 7 0 0 1 0 2Z"/>',
    park: '<path d="M12 21v-9M7 14c-3-1-4-4-3-7 3 0 5 1 6 4M17 13c3-1 4-4 3-7-3 0-5 1-6 4M9 8c-1-3 0-5 3-7 3 2 4 4 3 7"/>',
    satellite: '<path d="m7 7 10 10M8 3l4 4-5 5-4-4 5-5ZM16 13l5 5-5 3-3-3 3-5Z"/><path d="M3 21 8 16"/>',
    export: '<path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8"/>',
    clear: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
    pan: '<path d="M8 11V5a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8c0 5-3 8-8 8h-1c-2 0-3-1-4-2l-4-5a2 2 0 0 1 3-3l2 2"/>',
    draw: '<path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4M4 21h16"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    leaf: '<path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-6 8-16Z"/><path d="M4 21c3-5 7-8 12-11"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 0 14h-2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.4-3h.9A5 5 0 0 0 22 9.8C22 6 17.5 3 12 3Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="11" cy="7" r=".8"/><circle cx="16" cy="8" r=".8"/>',
  };
  const icon = (name, extra = "") => `<svg class="dg-editor-icon${extra ? ` ${extra}` : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.view}</svg>`;
  const menuLabel = (name, safeLabel) => `<span class="dg-editor-menu-icon">${icon(name)}</span><span class="dg-editor-menu-label">${safeLabel}</span><svg class="dg-editor-menu-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg>`;
  const panelHead = (name, safeTitle, safeDescription) => `<div class="dg-editor-panel-head">${icon(name)}<span><strong>${safeTitle}</strong><small>${safeDescription}</small></span></div>`;
  window.DG_EDITOR_UI = Object.freeze({ icon, menuLabel, panelHead });
})();
