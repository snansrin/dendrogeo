"use strict";
/* One parent-scoped workspace; switching never reuses the parent's record ID. */
(function(root){
 function create(ports){
  let base=null,rows=[],current=null,host=null,epoch=0,ready=false,editing=false,working=false;
  const status=message=>{const node=host?.querySelector("#dgStageStatus");if(node)node.textContent=message;};
  function setWorking(value){
   working=value;if(!host)return;host.setAttribute("aria-busy",String(value));
   host.querySelectorAll("button").forEach(button=>{if(value){button.dataset.stageDisabled=button.disabled?"1":"0";button.disabled=true;}else if(button.dataset.stageDisabled!==undefined){button.disabled=button.dataset.stageDisabled==="1";delete button.dataset.stageDisabled;}});
  }
  const drawing=root.DG_PARK_STAGE_DRAWING_UI.create({...ports.drawing,status,parentGeometry:()=>base?ports.geometry(base.park):null});
  function render(){
   if(!host||!base)return;
   host.innerHTML=root.DG_PARK_STAGE_VIEW.render({escape:ports.escape,baseName:base.row.name,rows,selectedId:current?.row?.id===base.row.id?null:current?.row?.id,ready,editing,status:""});
  }
  async function present({park,row}){
   const token=++epoch;drawing.cancel();editing=false;current={park,row};
   if(!row){base=null;return;}
   const scope=row.geom_json?.stage_scope;
   if(!scope){base={park,row};rows=[];}
   else if(base?.row.id!==scope.parentId){base=null;return;}
   const panel=ports.document.getElementById("parkInfo");if(!panel)return;
   host=ports.document.createElement("section");host.id="dgParkStageWorkspace";host.className="dg-png-card dg-stage-workspace";
   host.setAttribute("aria-label","Etap seçimi");host.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-stage-action]");if(!button||button.disabled)return;
    void action(button.dataset.stageAction).catch(error=>status(error.message||"Etap işlemi tamamlanamadı."));
   });panel.append(host);ready=false;render();
   try{
    const [available,list]=await Promise.all([ports.store.ready(),ports.store.list(base.row.id)]);
    if(token!==epoch)return;ready=available;rows=list.filter(r=>r.geom_json?.stage_scope?.parentId===base.row.id);render();
   }catch(error){if(token===epoch)status("Etap listesi alınamadı: "+error.message);}
  }
  async function switchTo(candidate){
   const token=epoch;
   const activate=root.DG_ACTIVATE_STAGE_SCOPE.create({isBusy:ports.isBusy,validate:ports.validate,approveTransition:ports.approveTransition,isCurrent:()=>token===epoch,
    draw:async value=>{drawing.cancel();await ports.clearAnalysis();await ports.draw(value);}});
   return activate(candidate);
  }
  async function action(name){
   if(working||ports.isBusy())return;
   if(name==="edit"){if(!ready)return;editing=true;render();host.querySelector("#dgStageName")?.focus();return;}
   if(name==="cancel"){drawing.cancel();editing=false;render();return;}
   if(name==="draw"){drawing.start();return;}
   if(name==="undo"){drawing.undo();return;}
   if(name==="apply"){
    const value=host.querySelector("#dgStageSelect").value;
    if(value!=="whole"&&!ready)throw Error("Sunucu etap koruması etkin olmadan etapla çalışılamaz.");
    const candidate=value==="whole"?base.park:root.DG_PARK_STAGE_GEOMETRY.candidate(rows.find(r=>String(r.id)===value));
    if((value==="whole"&&current.row.id===base.row.id)||String(current.row.id)===value)return;
    setWorking(true);status("Çalışma kapsamı değiştiriliyor…");try{await switchTo(candidate);}finally{setWorking(false);}return;
   }
   if(name!=="save"||!ready)return;
   const label=host.querySelector("#dgStageName")?.value.trim();if(!label)throw Error("Etap adını yazın.");
   const token=epoch,parent=base,ring=drawing.ring();setWorking(true);
   try{
    status("Etap sınırı doğrulanıyor…");
    const polygon=await ports.polygon();if(token!==epoch)return;
    const geometry=root.DG_PARK_STAGE_GEOMETRY.clip(ring,ports.geometry(parent.park),polygon);
    const row=await ports.store.create(parent.row.id,label,geometry);if(token!==epoch)return;
    rows=[...rows.filter(r=>r.id!==row.id),row];
    const selected=await switchTo(root.DG_PARK_STAGE_GEOMETRY.candidate(row));
    if(!selected)status("Etap kaydedildi. Çalışma kapsamını değiştirmek için listeden seçin.");
   }finally{setWorking(false);}
  }
  return Object.freeze({present,clear(){++epoch;drawing.cancel();host=null;},isDrawing:()=>editing});
 }
 root.DG_PARK_STAGE_WORKSPACE_UI=Object.freeze({create});
})(window);
