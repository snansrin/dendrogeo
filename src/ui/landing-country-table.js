"use strict";
window.DG_RENDER_LANDING_COUNTRY_TABLE=(()=>{
 const bindings=new WeakSet(),actionsByElement=new WeakMap();
 function bindLandingCountryActions(element,actions){
  if(!element||typeof element.addEventListener!=="function")return;
  actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);
  const activate=control=>{const action=actionsByElement.get(element)?.zoomCountry;if(typeof action==="function")action(control.dataset.landingPlace);};
  element.addEventListener("click",event=>{const control=event.target?.closest?.('[data-landing-action="zoomCountry"]');if(control&&element.contains(control))activate(control);});
  element.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" "&&event.key!=="Spacebar")return;const control=event.target?.closest?.('[data-landing-action="zoomCountry"]');if(control&&element.contains(control)){event.preventDefault();activate(control);}});
 }
 function render(result,{element,escape:esc,actions}){const body=element('tblCountry')?.querySelector?.('tbody');if(body){body.innerHTML=(result.data||[]).slice(0,20).map(r=>`<tr class="clickable-row" tabindex="0" role="link" data-landing-action="zoomCountry" data-landing-place="${esc(r.country)}"><td>${esc(r.country)}</td><td>${r.records}</td><td>${r.carbon_t}</td><td>${Number.isFinite(+r.avg_dbh)?(+r.avg_dbh).toFixed(1):"—"}</td><td>${r.avg_height||"—"}</td></tr>`).join('')||'<tr><td colspan=5>Henüz veri yok</td></tr>';bindLandingCountryActions(body,actions);}}
 return Object.freeze({render,bind:bindLandingCountryActions});
})();
