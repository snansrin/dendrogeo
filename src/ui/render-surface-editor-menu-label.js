"use strict";
/* Render the shared accessible menu label pattern. */
(function(root){
  function render({icon,label,ui,translate,escape}){const safe=escape(translate(label));return ui?.menuLabel?ui.menuLabel(icon,safe):`<span class="dg-editor-menu-icon">${icon}</span><span class="dg-editor-menu-label">${safe}</span><span class="dg-editor-menu-chevron" aria-hidden="true">⌄</span>`;}
  root.DG_RENDER_SURFACE_EDITOR_MENU_LABEL=Object.freeze({render});
})(window);
