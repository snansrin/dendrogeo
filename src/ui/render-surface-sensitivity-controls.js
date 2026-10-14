"use strict";

/* Render the original class sensitivity sliders and opacity control. */
window.DG_RENDER_SURFACE_SENSITIVITY_CONTROLS={
  render({model,record,classes,meta,focus,rawView,brush,sectionsOpen,opacity,translate,escape}){
    let html=`<details id="dgSensThresholdDetails" class="dg-sens-details" ontoggle="dgSensRememberSection(this)" ${sectionsOpen?"open":""}><summary>${escape(translate("Hassasiyet barları"))}<span class="dg-paint-chevron" aria-hidden="true">⌄</span></summary>`;
    for(const key of classes){const item=meta(key);html+=`<div class="dg-sens-row"><button type="button" class="dg-sens-label" onclick="dgSensFocus('${key}')" aria-pressed="${focus===key}">${item.emoji} ${escape(translate(item.tr))}</button><input id="dgSensRange-${key}" type="range" class="dg-sens-slider dg-range" min="0" max="100" step="1" value="${record.sens[key]}" oninput="dgSensSlide('${key}',this.value)" aria-label="${escape(translate(item.tr))} ${escape(translate("hassasiyet"))}" ${!model.scanned||model.disabled||rawView||brush?"disabled":""}><output class="dg-sens-count" id="dgSensCnt-${key}"></output></div>`;}
    html+=`<div class="dg-sens-row"><label class="dg-sens-label" for="dgSensOpacity">${escape(translate("Renk yoğunluğu"))}</label><input id="dgSensOpacity" type="range" class="dg-sens-slider dg-range" min="0" max="100" value="${opacity}" oninput="dgSensOpacity(this.value)"><output class="dg-sens-count" id="dgSensOpacityValue">%${opacity}</output></div></details>`;
    return html;
  }
};
