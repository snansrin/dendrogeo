"use strict";
/* Upper tools menu; retain the actual stage host and existing GIS menu behavior. */
(function(root){
 function create({document,windowRef,getMap}){
  let menu=null,host=null,hint=null,cutPanel=null;
  const layout=root.DG_GIS_WORKSPACE_MENU_POSITION?.create({windowRef});
  function hideCuts(){if(!cutPanel)return;cutPanel.remove();cutPanel=null;getMap?.()?.invalidateSize?.({pan:false});}
  function clear(){menu?.remove();hint?.remove();hideCuts();menu=null;host=null;hint=null;}
  function mount(element){
   clear();host=element;const bar=document.getElementById("surfaceMenuBar");
   if(!bar){document.getElementById("parkInfo")?.append(host);return;}
   menu=document.createElement("details");menu.id="dgStageToolsMenu";menu.className="dg-editor-menu";menu.dataset.menuOwner="stage";menu.dataset.menuOrder="25";
   const summary=document.createElement("summary");summary.textContent="🧩 Araçlar";
   const body=document.createElement("div");body.className="dg-editor-menu-body";body.append(host);menu.append(summary,body);
   menu.addEventListener("toggle",()=>{if(menu?.open){bar.querySelectorAll(":scope > details[open]").forEach(other=>{if(other!==menu)other.open=false;});layout?.position(menu);}});
   bar.append(menu);[...bar.children].sort((a,b)=>Number(a.dataset.menuOrder)-Number(b.dataset.menuOrder)).forEach(child=>bar.append(child));
  }
  function open(){if(menu){menu.scrollIntoView?.({block:"nearest"});menu.open=true;layout?.position(menu);}}
  function showHint(text,review,cancel){
   hint?.remove();const container=getMap?.()?.getContainer?.();if(!container)return;
   hint=document.createElement("div");hint.className="leaflet-control dg-stage-map-hint";
   const note=document.createElement("p");note.className="dg-meta";note.dataset.stageHint="";note.textContent=text;note.setAttribute("role","status");
   const buttons=document.createElement("div");buttons.className="dg-stage-actions";
   for(const [label,callback] of [["Ad ver ve kaydet",review],["Vazgeç",cancel]])if(callback){const button=document.createElement("button");button.className="dg-png-btn";button.type="button";button.textContent=label;button.addEventListener("click",callback);buttons.append(button);}
   hint.append(note,buttons);for(const type of ["click","pointerdown","dblclick"])hint.addEventListener(type,event=>event.stopPropagation());(document.getElementById("surfaceMapWorkspace")||container).before(hint);
  }
  function showCuts({name,onName,select,save,cancel}){
   hideCuts();const workspace=document.getElementById("surfaceMapWorkspace");if(!workspace)return;
   cutPanel=document.createElement("aside");cutPanel.className="dg-stage-cut-panel dg-png-card";cutPanel.setAttribute("aria-label","Başlangıç ve bitiş sınırları");
   const title=document.createElement("strong");title.textContent="Etap sınırları";
   const toggle=document.createElement("button");toggle.type="button";toggle.className="dg-png-btn";toggle.textContent="Küçült";toggle.setAttribute("aria-expanded","true");
   const body=document.createElement("div");body.className="dg-stage-cut-body";
   toggle.addEventListener("click",()=>{body.hidden=!body.hidden;toggle.textContent=body.hidden?"Sınırları aç":"Küçült";toggle.setAttribute("aria-expanded",String(!body.hidden));});
   const note=document.createElement("p");note.className="dg-meta";note.textContent="1–2 başlangıç, 3–4 bitiş. Noktaları köprü boyunca yerleştirin.";
   body.append(note);
   for(const [index,label] of [[0,"Başlangıç sınırı"],[1,"Bitiş sınırı"]]){const button=document.createElement("button");button.type="button";button.className="dg-png-btn";button.dataset.cutBoundary=String(index);button.textContent=label+" · 0/2";button.addEventListener("click",()=>select(index));body.append(button);}
   const status=document.createElement("p");status.className="dg-meta";status.dataset.cutStatus="";status.setAttribute("role","status");body.append(status);
   const label=document.createElement("label");label.className="lbl";label.htmlFor="dgStageCutName";label.textContent="ETAP ADI";
   const input=document.createElement("input");input.id="dgStageCutName";input.className="dg-png-input";input.maxLength=80;input.value=name;input.placeholder="Örn. 1. etap";input.addEventListener("input",()=>onName(input.value));body.append(label,input);
   for(const [text,callback,key] of [["Etap olarak kaydet",save,"save"],["Vazgeç",cancel,"cancel"]]){const button=document.createElement("button");button.type="button";button.className="dg-png-btn"+(key==="save"?" primary":"");button.textContent=text;button.dataset.cutAction=key;button.disabled=key==="save";button.addEventListener("click",callback);body.append(button);}
   cutPanel.append(title,toggle,body);for(const type of ["click","dblclick","pointerdown","wheel"])cutPanel.addEventListener(type,event=>event.stopPropagation());workspace.append(cutPanel);getMap?.()?.invalidateSize?.({pan:false});
  }
  return Object.freeze({mount,clear,open,showHint,showCuts,hideCuts,cutProgress({counts,active}){cutPanel?.querySelectorAll("[data-cut-boundary]").forEach(button=>{const i=Number(button.dataset.cutBoundary);button.textContent=(i?"Bitiş":"Başlangıç")+" sınırı · "+counts[i]+"/2";button.setAttribute("aria-pressed",String(i===active));});},cutReady(value){const button=cutPanel?.querySelector('[data-cut-action="save"]');if(button)button.disabled=!value;},cutPadding(){return [cutPanel?cutPanel.getBoundingClientRect().width+28:24,24];},setBusy(value){for(const node of [hint,cutPanel])node?.querySelectorAll("button,input").forEach(button=>{if(value){button.dataset.stageDisabled=button.disabled?"1":"0";button.disabled=true;}else if(button.dataset.stageDisabled!==undefined){button.disabled=button.dataset.stageDisabled==="1";delete button.dataset.stageDisabled;}});},hideHint(){hint?.remove();hint=null;},status(text){for(const node of [hint?.querySelector("[data-stage-hint]"),cutPanel?.querySelector("[data-cut-status]")])if(node)node.textContent=text;},close(){if(menu)menu.open=false;},refresh(){layout?.position(menu);}});
 }
 root.DG_PARK_STAGE_MENU_UI=Object.freeze({create});
})(window);
