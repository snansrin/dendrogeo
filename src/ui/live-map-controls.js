"use strict";

/* Keep map toolbar markup declarative while preserving legacy map APIs. */
(function(root){
  function bind({document}){
    if(root._dgLiveMapControlsBound)return;
    root._dgLiveMapControlsBound=true;
    document.addEventListener("click",event=>{
      const element=event.target?.closest?.("[data-dg-map-action]");
      if(element?.dataset.dgMapAction==="toggle-park-mode")root.dgToggleParkMode();
      else if(element?.dataset.dgMapAction==="refresh")root.loadLiveMap();
    });
    let searching=false;
    document.addEventListener("submit",async event=>{
      const form=event.target?.closest?.("#dgLiveParkSearch");if(!form)return;
      event.preventDefault();if(searching)return;
      const input=form.querySelector("#dgLiveParkName"),name=input?.value.trim();
      if(!name){input?.focus();return;}
      const button=form.querySelector('button[type="submit"]'),status=form.querySelector("#dgLiveParkSearchStatus");
      const t=text=>typeof root.dgCf==="function"?root.dgCf(text):text;
      const state=root.DG_LC_SENS?.state;
      if(document.getElementById?.("dgLiveProjects")?.getAttribute("aria-busy")==="true"||root._dgLandCoverBusy||state?.busy||state?.saving||state?.editing||state?.record?.draftDirty||state?.brush||state?.draw||state?.objectPick||root.DG_PARK_STAGES?.isDrawing?.()){
        if(status)status.textContent=t("Önce açık çizim veya yüzey işlemini tamamla; mevcut çalışma korunuyor.");return;
      }
      searching=true;form.setAttribute?.("aria-busy","true");if(button)button.disabled=true;if(status)status.textContent=t("Park aranıyor…");
      try{await root.dgScanSearchByName(name);if(status)status.textContent="";}
      catch(error){if(status)status.textContent=t("Park araması tamamlanamadı: ")+String(error.message||error);}
      finally{searching=false;form.setAttribute?.("aria-busy","false");if(button)button.disabled=false;}
    });
    document.addEventListener("change",event=>{
      const element=event.target?.closest?.("[data-dg-map-action='base-layer']");
      if(element)root.switchBaseLayer(element.value);
    });
  }
  root.DG_LIVE_MAP_CONTROLS=Object.freeze({bind});
})(window);

window.DG_LIVE_MAP_CONTROLS.bind({document});
