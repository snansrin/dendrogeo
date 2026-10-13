"use strict";
/* Render the shared panel heading while keeping the icon/text fallback. */
(function(root){
  function render({icon,title,description,ui,translate,escape}){const safeTitle=escape(translate(title)),safeDescription=escape(translate(description));return ui?.panelHead?ui.panelHead(icon,safeTitle,safeDescription):`<div class="dg-editor-panel-head"><span class="dg-editor-panel-fallback-icon" aria-hidden="true">${icon}</span><span><strong>${safeTitle}</strong><small>${safeDescription}</small></span></div>`;}
  root.DG_RENDER_SURFACE_EDITOR_PANEL_HEAD=Object.freeze({render});
})(window);
