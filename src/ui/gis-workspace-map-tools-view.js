/* Build the existing map-tools menu controls; actions remain owned by workspace. */
(function(root){
 "use strict";
 function create({getElement,el,getMapTool,activateTool,closeTool,setStatus,focusPark,coordinateQuery,copyCoordinate}){
  function newControl(label,onClick,kind){
   const button=el("button","dg-png-btn ghost sm",label);button.type="button";
   if(kind)button.dataset.tool=kind;
   button.addEventListener("click",onClick);return button;
  }
  function sync(){
   const bar=getElement("surfaceMenuBar"),viewMenu=bar?.querySelector('details[data-menu-order="20"]');
   const body=viewMenu?.querySelector(".dg-editor-menu-body");
   if(!body||body.querySelector("#dgUxMapTools"))return;
   const section=el("section","dg-editor-menu-section dg-ux-map-section");
   section.id="dgUxMapTools";
   section.append(el("span","dg-editor-menu-section-label","HARİTA ÖLÇÜM VE İNCELEME"));
   const nav=el("div","dg-ux-tool-grid");
   nav.append(
    newControl("📐 Mesafe ölç",()=>activateTool("distance"),"distance"),
    newControl("⬡ Alan ölç",()=>activateTool("area"),"area"),
    newControl("✓ Ölçümü bitir",()=>{closeTool();setStatus("Geçici ölçüm kaldırıldı.");}),
    newControl("⌖ Parka odaklan",focusPark)
   );
   const current=nav.querySelector('button[data-tool="'+getMapTool()+'"]');
   if(current){current.setAttribute("aria-pressed","true");current.classList.add("is-active");}
   const coordLabel=el("label","dg-png-label","WGS84 · ENLEM, BOYLAM");
   coordLabel.htmlFor="dgUxCoordInput";
   const row=el("div","dg-ux-coordinate-row"),input=el("input","dg-png-input");
   input.id="dgUxCoordInput";input.type="text";input.placeholder="39.992000, 32.650000";
   input.inputMode="decimal";input.autocomplete="off";
   input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();coordinateQuery();}});
   row.append(input,newControl("Git",coordinateQuery),newControl("Kopyala",copyCoordinate));
   section.append(nav,coordLabel,row);
   const note=el("p","dg-ux-option-note","Ölçümler geçici harita araçlarıdır; analiz hücrelerini veya kayıtları değiştirmez.");
   note.id="dgUxMapStatus";note.setAttribute("role","status");note.setAttribute("aria-live","polite");
   section.append(note);body.append(section);
  }
  return Object.freeze({sync});
 }
 root.DG_GIS_WORKSPACE_MAP_TOOLS_VIEW=Object.freeze({create});
})(window);
