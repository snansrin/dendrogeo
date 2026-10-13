"use strict";

/* Preserve the popup markup, action names and class choice order. */
window.DG_SURFACE_CELL_DECISION_POPUP_VIEW={
  render({model,escape,translate}){
    let html=`<div class="dg-sens-popup"><b>${escape(translate(model.currentClass))}</b> · ${model.areaM2.toFixed(1)} m²<p>${escape(translate(model.description))}</p><div class="dg-sens-actions">`;
    for(const option of model.options)html+=`<button type="button" class="dg-png-btn ${option.selected?"primary":"ghost"} sm" onclick="dgSensDecide('${model.key}','${option.classKey}')">${option.emoji} ${escape(translate(option.label))}</button>`;
    if(model.canUndo)html+=`<button type="button" class="dg-png-btn ghost sm" onclick="dgSensUndo('${model.key}')">↩ ${escape(translate("Geri al"))}</button>`;
    return html+="</div></div>";
  }
};
