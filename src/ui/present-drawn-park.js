"use strict";
/* Compose existing park components without owning registry or OSM state. */
window.DG_PRESENT_DRAWN_PARK={present({park,row,hectares},ports){const {element,escape,translate}=ports;
 const alternateSelector=ports.renderAlternates(park),info=element('parkInfo');info.style.display='block';info.innerHTML=ports.renderPanel({name:park.name,escape,hectares,parkIdChip:ports.idChip(row),registerRetryMarkup:!row?'<div class="dg-png-card"><button class="dg-png-btn red sm" data-park-action="retryRegister">🔄 Yeniden dene</button></div>':'',alternateSelector,projectOptionsMarkup:ports.projectOptions(row?row.id:null,!park.stageRow)});
 if(window.DG_PARK_STAGES)void window.DG_PARK_STAGES.present({park,row}).catch(error=>console.warn("DENDROGEO · etap paneli:",error));
 ports.mountMenus();ports.renderReference();ports.notify(translate('✓ Park algılandı: ')+((row&&row.name)||park.name||'')+' · '+hectares+' ha'+(row?' · '+translate('kimlik #')+row.id:''),'ok','🌳');
}};
