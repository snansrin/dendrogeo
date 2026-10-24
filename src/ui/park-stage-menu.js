"use strict";
/* Upper tools menu; retain the actual stage host and existing GIS menu behavior. */
(function(root){
 function create({document,windowRef,getMap}){
  let menu=null,host=null,hint=null;
  const layout=root.DG_GIS_WORKSPACE_MENU_POSITION?.create({windowRef});
  function clear(){menu?.remove();hint?.remove();menu=null;host=null;hint=null;}
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
  return Object.freeze({mount,clear,open,showHint,setBusy(value){hint?.querySelectorAll("button").forEach(button=>{button.disabled=value;});},hideHint(){hint?.remove();hint=null;},status(text){const note=hint?.querySelector("[data-stage-hint]");if(note)note.textContent=text;},close(){if(menu)menu.open=false;},refresh(){layout?.position(menu);}});
 }
 root.DG_PARK_STAGE_MENU_UI=Object.freeze({create});
})(window);
