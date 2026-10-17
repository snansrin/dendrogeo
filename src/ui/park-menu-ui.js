"use strict";
/* Own park/editor menu DOM placement, order and dismiss interactions. */
(function(root){
 function mount({document:doc,clearMenus,arrangeMenus,translate,escape,editorUi}){
  const host=doc.getElementById("surfaceParkTools");if(!host)return;
  const panel=doc.getElementById("parkInfo"),retained=new Map(["parkGridTools","parkLayerTools","gridSummary"].map(id=>[id,panel?.querySelector?.("#"+id)||doc.getElementById(id)]));
  clearMenus("park");
  host.replaceChildren();
  const nav=doc.createElement("nav");nav.className="dg-editor-menubar";nav.setAttribute("aria-label",translate("Harita menüsü"));
  for(const [id,label,icon,description] of [["parkGridTools","Grid & Waypoint","grid","Grid oluşturma ve waypoint araçları"],["parkLayerTools","Katmanlar","layers","Haritada gösterilecek katmanlar"]]){
   const controls=retained.get(id);if(!controls)continue;
   const menu=doc.createElement("details");menu.className="dg-editor-menu";menu.setAttribute("data-menu-owner","park");menu.setAttribute("data-menu-order",id==="parkGridTools"?"30":"40");
   const title=translate(label),subtitle=translate(description),safeTitle=escape(title),safeSubtitle=escape(subtitle);
   const summary=doc.createElement("summary");summary.innerHTML=editorUi?.menuLabel(icon,safeTitle)||safeTitle+" ⌄";
   const body=doc.createElement("div");body.className="dg-editor-menu-body";body.innerHTML=editorUi?.panelHead(icon,safeTitle,safeSubtitle)||"";body.append(controls);
   if(id==="parkGridTools"){const gridSummary=retained.get("gridSummary");if(gridSummary)body.append(gridSummary);}
   menu.append(summary,body);menu.addEventListener("toggle",()=>{if(menu.open)(doc.getElementById("surfaceMenuBar")||nav).querySelectorAll("details[open]").forEach(other=>{if(other!==menu)other.open=false;});});nav.append(menu);
  }
  host.append(nav);arrangeMenus();
 }
 function clear({document:doc,owner}){
  const bar=doc.getElementById("surfaceMenuBar");if(!bar?.append)return;
  bar.querySelectorAll('[data-menu-owner="'+owner+'"]').forEach(menu=>menu.remove());
 }
 function arrange({document:doc}){
  const bar=doc.getElementById("surfaceMenuBar");if(!bar?.append)return;
  for(const id of ["surfaceParkTools","surfaceBrushTools"]){
   doc.getElementById(id)?.querySelectorAll(".dg-editor-menu").forEach(menu=>bar.append(menu));
  }
  [...bar.children].sort((a,b)=>Number(a.dataset.menuOrder)-Number(b.dataset.menuOrder)).forEach(menu=>bar.append(menu));
 }
 function bindDismissal(doc){
  if(typeof doc.addEventListener!=="function")return;
  doc.addEventListener("pointerdown",e=>{if(!e.target.closest?.("#surfaceEditorMenu"))doc.querySelectorAll("#surfaceEditorMenu details[open]").forEach(menu=>{menu.open=false;});});
  doc.addEventListener("keydown",e=>{if(e.key!=="Escape")return;doc.querySelectorAll("#surfaceEditorMenu details[open]").forEach(menu=>{menu.open=false;menu.querySelector("summary")?.focus();});});
 }
 root.DG_PARK_MENU_UI=Object.freeze({mount,clear,arrange,bindDismissal});
})(window);
