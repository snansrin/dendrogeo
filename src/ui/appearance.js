"use strict";
/* Device preferences and theme presentation; no account, map or analysis writes. */
(function(root){
 let preference=root.DG_APPEARANCE_POLICY.normalize(root.DG_APPEARANCE_PREFERENCE.read());
 const media=root.matchMedia?.('(prefers-color-scheme: dark)');
 function state(){return{preference,theme:root.DG_APPEARANCE_POLICY.resolve(preference,!!media?.matches)};}
 function refreshCharts(){
  if(!root.document?.documentElement||!root.getComputedStyle)return;
  const style=root.getComputedStyle(root.document.documentElement),mut=style.getPropertyValue('--mut').trim(),line=style.getPropertyValue('--line').trim();
  for(const chart of Object.values(root.Chart?.instances||{})){
   for(const scale of Object.values(chart.options?.scales||{})){if(scale.ticks)scale.ticks.color=mut;if(scale.grid)scale.grid.color=line;}
   chart.resize();chart.update('none');
  }
 }
 function sync(){
  const doc=root.document;if(!doc)return;
  doc.querySelectorAll('[data-dg-dark-mode]').forEach(input=>{input.checked=state().theme==='dark';});
  doc.querySelectorAll('[data-dg-theme-system]').forEach(button=>button.setAttribute('aria-pressed',String(preference==='system')));
 }
 function apply(){
  if(!root.document?.documentElement)return;
  root.document.documentElement.dataset.theme=state().theme;
  root.document.documentElement.style.colorScheme=state().theme;
  sync();refreshCharts();
 }
 function set(value){preference=root.DG_APPEARANCE_POLICY.normalize(value);const stored=root.DG_APPEARANCE_PREFERENCE.write(preference);apply();return stored;}
 root.DG_APPEARANCE=Object.freeze({state,set,sync,refreshCharts});
 if(!root.document?.documentElement)return;
 apply();
 media?.addEventListener?.('change',()=>{if(preference==='system')apply();});
 root.addEventListener('storage',event=>{if(event.key===root.DG_APPEARANCE_PREFERENCE.key||event.key===null){preference=root.DG_APPEARANCE_POLICY.normalize(root.DG_APPEARANCE_PREFERENCE.read());apply();}});
 root.document.addEventListener('DOMContentLoaded',sync);
 root.document.addEventListener('change',event=>{if(event.target.matches?.('[data-dg-dark-mode]'))set(event.target.checked?'dark':'light');});
 root.document.addEventListener('click',event=>{if(event.target.closest?.('[data-dg-theme-system]'))set('system');});
 root.document.addEventListener('toggle',event=>{if(event.target.matches?.('[data-personal-summary]')&&event.target.open)refreshCharts();},true);
})(window);
