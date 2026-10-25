"use strict";
/* Upper tools menu; retain the actual stage host and existing GIS menu behavior. */
(function(root){
 function create({document,windowRef,getMap}){
  let menu=null,host=null,hint=null,cutPanel=null,dockLink=null;
  const layout=root.DG_GIS_WORKSPACE_MENU_POSITION?.create({windowRef});
  const side=root.DG_PARK_STAGE_SIDE_LAYOUT?.create({document,windowRef,getMap});
  function hideCuts(){if(!cutPanel)return;side?.clear();cutPanel.remove();cutPanel=null;dockLink?.remove();dockLink=null;if(host)host.hidden=false;layout?.position(menu);}
  function clear(){menu?.remove();hint?.remove();hideCuts();menu=null;host=null;hint=null;}
  function mount(element){
   clear();host=element;const bar=document.getElementById("surfaceMenuBar");
   if(!bar){document.getElementById("parkInfo")?.append(host);return;}
   menu=document.createElement("details");menu.id="dgStageToolsMenu";menu.className="dg-editor-menu";menu.dataset.menuOwner="stage";menu.dataset.menuOrder="25";
   const summary=document.createElement("summary");summary.textContent="🧩 Etaplar";
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
  function showCuts({name,onName,select,save,cancel,detailed=false,undo,reset,revision=false,selectPoint,deletePoint,remove}){
   hideCuts();if(!side)throw Error("Etap yan paneli yüklenemedi.");
   cutPanel=document.createElement("aside");cutPanel.className="dg-stage-cut-panel dg-png-card";cutPanel.setAttribute("aria-label","Başlangıç ve bitiş sınırları");
   const title=document.createElement("strong");title.textContent="Etap sınırları";
   const toggle=document.createElement("button");toggle.type="button";toggle.className="dg-png-btn";toggle.textContent="Küçült";toggle.setAttribute("aria-expanded","true");
   const body=document.createElement("div");body.className="dg-stage-cut-body";
   const footer=document.createElement("div");footer.className="dg-stage-cut-footer";
   function collapse(value){body.hidden=value;footer.hidden=value;cutPanel.dataset.collapsed=String(value);toggle.textContent=value?"Etap":"Küçült";toggle.setAttribute("aria-label",value?"Sınırları aç":"Küçült");toggle.setAttribute("aria-expanded",String(!value));side.position();}
   toggle.addEventListener("click",()=>collapse(!body.hidden));
   const note=document.createElement("p");note.className="dg-meta";note.textContent=detailed?"Başlangıç / bitiş düğmeleriyle hattı seçin. Nokta ekleyin veya sürükleyin. Her hatta en az iki nokta olunca geçerli alan kaydedilebilir.":"1–2 başlangıç, 3–4 bitiş. Noktaları köprü boyunca yerleştirin.";
   if(detailed){const help=document.createElement("details"),summary=document.createElement("summary");help.className="dg-stage-point-actions";summary.textContent="Nasıl çizilir?";help.append(summary,note);body.append(help);}else body.append(note);
   for(const [index,label] of [[0,"Başlangıç sınırı"],[1,"Bitiş sınırı"]]){const button=document.createElement("button");button.type="button";button.className="dg-png-btn";button.dataset.cutBoundary=String(index);button.textContent=label+" · 0/2";button.addEventListener("click",()=>select(index));body.append(button);}
   if(detailed){const label=document.createElement("label");label.className="lbl";label.htmlFor="dgStageCutPoint";label.textContent="NOKTA SEÇ";const points=document.createElement("select");points.id="dgStageCutPoint";points.className="dg-png-select";points.addEventListener("change",()=>selectPoint?.(Number(points.value)));const button=document.createElement("button");button.type="button";button.className="dg-png-btn";button.dataset.cutEdit="delete-point";button.textContent="Seçili noktayı sil";button.disabled=true;button.addEventListener("click",()=>deletePoint?.());body.append(label,points,button);}
   if(detailed){const actions=document.createElement("details"),summary=document.createElement("summary");summary.textContent="Nokta işlemleri";actions.className="dg-stage-point-actions";actions.append(summary);for(const [text,callback,key]of [["Son noktayı geri al",undo,"undo"],["Seçili hattı temizle",reset,"reset"]]){const button=document.createElement("button");button.type="button";button.className="dg-png-btn";button.dataset.cutEdit=key;button.textContent=text;button.addEventListener("click",callback);actions.append(button);}body.append(actions);}
   const status=document.createElement("p");status.className="dg-meta";status.dataset.cutStatus="";status.setAttribute("role","status");body.append(status);
   const label=document.createElement("label");label.className="lbl";label.htmlFor="dgStageCutName";label.textContent="ETAP ADI";
   const input=document.createElement("input");input.id="dgStageCutName";input.className="dg-png-input";input.maxLength=80;input.value=name;input.placeholder="Örn. 1. etap";input.addEventListener("input",()=>onName(input.value));body.append(label,input);
   if(revision){const info=document.createElement("p");info.className="dg-meta";info.textContent="Yeni etap sürümü kaydedilir; önceki ölçümler korunur.";body.append(info);}
   for(const [text,callback,key] of [["Etap olarak kaydet",save,"save"],["Vazgeç",cancel,"cancel"]]){const button=document.createElement("button");button.type="button";button.className="dg-png-btn"+(key==="save"?" primary":"");button.textContent=text;button.dataset.cutAction=key;button.disabled=key==="save";button.addEventListener("click",callback);footer.append(button);}
   if(remove){const button=document.createElement("button");button.type="button";button.className="dg-png-btn";button.dataset.cutAction="delete-stage";button.textContent="Etap sil";button.addEventListener("click",remove);footer.append(button);}
   const header=document.createElement("div");header.className="dg-stage-cut-head";header.append(title,toggle);cutPanel.append(header,body,footer);for(const type of ["click","dblclick","pointerdown","wheel"])cutPanel.addEventListener(type,event=>event.stopPropagation());
   if(host)host.hidden=true;const dock=menu?.querySelector(".dg-editor-menu-body");if(dock){dockLink=document.createElement("button");dockLink.type="button";dockLink.className="dg-png-btn";dockLink.textContent="Sol etap panelini aç";dockLink.addEventListener("click",()=>{collapse(false);if(menu)menu.open=false;getMap?.()?.getContainer?.()?.scrollIntoView?.({block:"nearest"});});dock.append(dockLink);}if(menu)menu.open=false;side.mount(cutPanel);
  }
  return Object.freeze({mount,clear,open,showHint,showCuts,hideCuts,cutProgress({counts,active,selected=-1,detailed,finished}){cutPanel?.querySelectorAll("[data-cut-boundary]").forEach(button=>{const i=Number(button.dataset.cutBoundary);button.textContent=(i?"Bitiş":"Başlangıç")+" sınırı · "+counts[i]+(detailed?" nokta"+(finished[i]?" ✓":""):"/2");button.setAttribute("aria-pressed",String(i===active));});const select=cutPanel?.querySelector("#dgStageCutPoint");if(select){select.replaceChildren();const blank=document.createElement("option");blank.value="";blank.textContent="Numaralı noktayı seçin";blank.disabled=true;blank.selected=selected<0;select.append(blank);for(let i=0;i<counts[active];i++){const option=document.createElement("option");option.value=String(i);option.textContent=(active+1)+"."+(i+1);option.selected=i===selected;select.append(option);}const button=cutPanel.querySelector('[data-cut-edit="delete-point"]');if(button)button.disabled=selected<0;}},cutReady(value){const button=cutPanel?.querySelector('[data-cut-action="save"]');if(button)button.disabled=!value;},cutPadding(){return [24,24];},setBusy(value){for(const node of [hint,cutPanel])node?.querySelectorAll("button,input,select").forEach(button=>{if(value){button.dataset.stageDisabled=button.disabled?"1":"0";button.disabled=true;}else if(button.dataset.stageDisabled!==undefined){button.disabled=button.dataset.stageDisabled==="1";delete button.dataset.stageDisabled;}});},hideHint(){hint?.remove();hint=null;},status(text){for(const node of [hint?.querySelector("[data-stage-hint]"),cutPanel?.querySelector("[data-cut-status]")])if(node)node.textContent=text;},close(){if(menu)menu.open=false;},refresh(){layout?.position(menu);side?.position();}});
 }
 root.DG_PARK_STAGE_MENU_UI=Object.freeze({create});
})(window);
