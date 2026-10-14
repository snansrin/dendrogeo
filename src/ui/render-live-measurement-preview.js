"use strict";

/* Render the calculated preview and keep the save hint synchronized. */
window.DG_RENDER_LIVE_MEASUREMENT_PREVIEW={
  render({preview,element,getHint,translate}){
    const show=!!preview.show;
    element.style.display=show?"block":"none";
    const hint=getHint();
    if(hint)hint.style.display=show?"none":"block";
    if(!show||!preview.result)return;
    const r=preview.result,c=preview.request.circumferenceCm;
    element.innerHTML=`<b>${translate("Tahmini karbon")} · ${r.total_carbon.toFixed(1)} kg</b><br><small>${translate("Göğüs çevresi")} ${c.toFixed(1)} cm → DBH <output name="dbh_cm_display" for="mDbh">${r.dbh_cm.toFixed(1)}</output> cm · AGB ${r.agb.toFixed(1)} · BHB ${r.bhb.toFixed(1)} kg · ${translate("Hacim")} ${r.vol.toFixed(3)} m³ · ρ ${r.density_kg_m3} kg/m³</small>`;
  }
};
