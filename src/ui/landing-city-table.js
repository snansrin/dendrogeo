"use strict";
window.DG_RENDER_LANDING_CITY_TABLE=(()=>{
 const bindings=new WeakSet(),actionsByElement=new WeakMap();
 function bindLandingCityActions(element,actions){
  if(!element||typeof element.addEventListener!=="function")return;
  actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);
  const activate=control=>{const action=actionsByElement.get(element)?.zoomCity;if(typeof action==="function")action(control.dataset.landingPlace);};
  element.addEventListener("click",event=>{const control=event.target?.closest?.('[data-landing-action="zoomCity"]');if(control&&element.contains(control))activate(control);});
  element.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" "&&event.key!=="Spacebar")return;const control=event.target?.closest?.('[data-landing-action="zoomCity"]');if(control&&element.contains(control)){event.preventDefault();activate(control);}});
 }
 function render(result,{element,escape:esc,actions}){const body=element('tblCity')?.querySelector?.('tbody');if(body){body.innerHTML=(result.data||[]).slice(0,20).map(r=>`<tr class="clickable-row" tabindex="0" role="link" data-landing-action="zoomCity" data-landing-place="${esc(r.city)}"><td>${esc(r.city)}</td><td>${r.records}</td><td>${r.carbon_t}</td></tr>`).join('')||'<tr><td colspan=3>Henüz veri yok</td></tr>';bindLandingCityActions(body,actions);}}
 return Object.freeze({render,bind:bindLandingCityActions});
})();
