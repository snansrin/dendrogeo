"use strict";

/* Preserve the popup markup, action names and class choice order. */
window.DG_SURFACE_CELL_DECISION_POPUP_VIEW=(()=>{
  const bindings=new WeakSet(),actionsByDocument=new WeakMap();
  function bind(document,actions){
    if(!document||typeof document.addEventListener!=="function")return;
    actionsByDocument.set(document,actions||{});if(bindings.has(document))return;bindings.add(document);
    document.addEventListener("click",event=>{
      const button=event.target?.closest?.("[data-surface-cell-action]");if(!button||!document.contains(button))return;
      const handlers=actionsByDocument.get(document)||{},key=button.dataset.cellKey;
      if(button.dataset.surfaceCellAction==="decide")handlers.decide?.(key,button.dataset.classKey);
      else if(button.dataset.surfaceCellAction==="undo")handlers.undo?.(key);
    });
  }
  function render({model,escape,translate,document,actions}){
    bind(document,actions);
    let html=`<div class="dg-sens-popup"><b>${escape(translate(model.currentClass))}</b> · ${model.areaM2.toFixed(1)} m²<p>${escape(translate(model.description))}</p><div class="dg-sens-actions">`;
    for(const option of model.options)html+=`<button type="button" class="dg-png-btn ${option.selected?"primary":"ghost"} sm" data-surface-cell-action="decide" data-cell-key="${escape(model.key)}" data-class-key="${escape(option.classKey)}">${option.emoji} ${escape(translate(option.label))}</button>`;
    if(model.canUndo)html+=`<button type="button" class="dg-png-btn ghost sm" data-surface-cell-action="undo" data-cell-key="${escape(model.key)}">↩ ${escape(translate("Geri al"))}</button>`;
    return html+="</div></div>";
  }
  return Object.freeze({render,bind});
})();
