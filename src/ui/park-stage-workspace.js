"use strict";
/* One parent-scoped workspace; switching never reuses the parent's record ID. */
(function(root){
 function create(ports){
  let base=null,rows=[],current=null,host=null,epoch=0,ready=false,editing=false,working=false,proposals=[],preview=null,previewIndex=0,draftName="",partCount=2,freeDrawing=false;
  const menu=root.DG_PARK_STAGE_MENU_UI.create({document:ports.document,windowRef:ports.windowRef,getMap:ports.drawing.getMap});
  const status=message=>{const node=host?.querySelector("#dgStageStatus");if(node)node.textContent=message;menu.status(message);};
  function setWorking(value,token=epoch){
   if(token!==epoch)return;
   working=value;if(!host)return;host.setAttribute("aria-busy",String(value));
   assisted.setLocked(value);menu.setBusy(value);
   host.querySelectorAll("button,input,select").forEach(button=>{if(value){button.dataset.stageDisabled=button.disabled?"1":"0";button.disabled=true;}else if(button.dataset.stageDisabled!==undefined){button.disabled=button.dataset.stageDisabled==="1";delete button.dataset.stageDisabled;}});
  }
  const drawing=root.DG_PARK_STAGE_DRAWING_UI.create({...ports.drawing,status,parentGeometry:()=>base?ports.geometry(base.park):null});
  const assisted=root.DG_PARK_STAGE_ASSISTED_UI.create({...ports.drawing,status,parentGeometry:()=>base?ports.geometry(base.park):null,
   between:async points=>{const polygon=await ports.polygon();return root.DG_PARK_STAGE_CUT_GEOMETRY.between(ports.geometry(base.park),points,{polygon,clip:root.DG_PARK_STAGE_GEOMETRY.clip});},
   onInvalid:()=>{preview=null;render();menu.showHint("Sınırlar güncelleniyor…",null,()=>void action("cancel"));},onCancel:()=>{preview=null;menu.hideHint();render();},onPreview:result=>{preview=result;proposals=[];render();showHint();status("Önizleme hazır. İşaretleri sürükleyerek iki sınırı ayarlayabilirsiniz.");}});
  const area=geometry=>(ports.area(geometry)/10000).toFixed(2);
  function showHint(){menu.showHint("Seçili bölüm: "+area(preview.geometry)+" ha",()=>{menu.open();host?.querySelector("#dgStageName")?.focus();},()=>void action("cancel"));}
  function render(){
   if(!host||!base)return;
   draftName=host.querySelector("#dgStageName")?.value??draftName;
   host.innerHTML=root.DG_PARK_STAGE_VIEW.render({escape:ports.escape,baseName:base.row.name,rows,selectedId:current?.row?.id===base.row.id?null:current?.row?.id,ready,editing,status:"",proposals,previewIndex,previewArea:preview?area(preview.geometry):null,draftName,partCount,canSave:!!preview||freeDrawing});menu.refresh();
  }
  async function present({park,row}){
   const token=++epoch;drawing.cancel();assisted.clear();menu.clear();proposals=[];preview=null;draftName="";freeDrawing=false;editing=false;working=false;current={park,row};
   if(!row){base=null;return;}
   const scope=row.geom_json?.stage_scope;
   if(!scope){base={park,row};rows=[];}
   else if(base?.row.id!==scope.parentId){base=null;return;}
   const panel=ports.document.getElementById("parkInfo");if(!panel)return;
   host=ports.document.createElement("section");host.id="dgParkStageWorkspace";host.className="dg-png-card dg-stage-workspace";
   host.setAttribute("aria-label","Etap seçimi");host.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-stage-action]");if(!button||button.disabled)return;
    const token=epoch;void action(button.dataset.stageAction).catch(error=>{if(token===epoch)status(error.message||"Etap işlemi tamamlanamadı.");});
   });host.addEventListener("change",event=>{if(event.target.id==="dgStageProposal"){previewIndex=Number(event.target.value);preview=proposals[previewIndex];if(preview){assisted.show(preview);showHint();render();}}});menu.mount(host);ready=false;render();
   try{
    const [available,list]=await Promise.all([ports.store.ready(),ports.store.list(base.row.id)]);
    if(token!==epoch)return;ready=available;rows=list.filter(r=>r.geom_json?.stage_scope?.parentId===base.row.id);render();
   }catch(error){if(token===epoch)status("Etap listesi alınamadı: "+error.message);}
  }
  async function switchTo(candidate){
   const token=epoch;
   const activate=root.DG_ACTIVATE_STAGE_SCOPE.create({isBusy:ports.isBusy,validate:ports.validate,approveTransition:ports.approveTransition,isCurrent:()=>token===epoch,
    draw:async value=>{drawing.cancel();assisted.clear();menu.hideHint();await ports.clearAnalysis();if(token!==epoch)return false;return ports.draw(value);}});
   return activate(candidate);
  }
  async function action(name){
   if(working)return;
   if(name==="cancel"){drawing.cancel();assisted.clear();menu.hideHint();preview=null;proposals=[];freeDrawing=false;editing=false;render();return;}
   if(ports.isBusy()){status("Önce açık harita/yüzey işlemini tamamlayın; fırça, sınır çizimi, nesne seçimi veya harita ölçümünü kapatın.");return;}
   if(name==="edit"){if(!ready)return;editing=true;render();host.querySelector("#dgStageName")?.focus();return;}
   if(name==="pick"){drawing.cancel();assisted.clear();preview=null;proposals=[];freeDrawing=false;render();menu.close();assisted.start();menu.showHint("Başlangıç ve bitiş için haritada iki yere dokunun.",null,()=>void action("cancel"));return;}
   if(name==="suggest"){
    drawing.cancel();assisted.clear();menu.hideHint();freeDrawing=false;const token=epoch;partCount=Number(host.querySelector("#dgStagePartCount")?.value||2);preview=null;proposals=[];render();setWorking(true);
    try{const polygon=await ports.polygon();if(token!==epoch)return;
     proposals=root.DG_PARK_STAGE_CUT_GEOMETRY.suggest(ports.geometry(base.park),partCount,{polygon,clip:root.DG_PARK_STAGE_GEOMETRY.clip}).map(result=>({...result,areaLabel:area(result.geometry)+" ha"}));
     previewIndex=0;preview=proposals[0];render();if(preview){assisted.show(preview);showHint();}status(preview?.method==="separate-component"?proposals.length+" ayrık park parçası algılandı.":proposals.length+" bölüm önerisi hazır. Listeden seçip haritada kontrol edin.");
    }finally{setWorking(false,token);}return;
   }
   if(name==="draw"){assisted.clear();preview=null;proposals=[];freeDrawing=true;render();drawing.start();menu.close();menu.showHint("Haritada köşeleri seçin.",()=>menu.open(),()=>void action("cancel"));return;}
   if(name==="undo"){drawing.undo();return;}
   if(name==="apply"){
    const value=host.querySelector("#dgStageSelect").value;
    if(value!=="whole"&&!ready)throw Error("Sunucu etap koruması etkin olmadan etapla çalışılamaz.");
    const candidate=value==="whole"?base.park:root.DG_PARK_STAGE_GEOMETRY.candidate(rows.find(r=>String(r.id)===value));
    if((value==="whole"&&current.row.id===base.row.id)||String(current.row.id)===value)return;
    const token=epoch;setWorking(true);status("Çalışma kapsamı değiştiriliyor…");try{await switchTo(candidate);}finally{setWorking(false,token);}return;
   }
   if(name!=="save"||!ready)return;
   if(!preview&&!freeDrawing)throw Error("Önce bir bölüm önerisi veya iki sınır noktası seçin.");
   const label=host.querySelector("#dgStageName")?.value.trim();if(!label)throw Error("Etap adını yazın.");
   const token=epoch,parent=base,ring=drawing.ring(),selectedGeometry=preview?.geometry;setWorking(true);
   try{
    status("Etap sınırı doğrulanıyor…");
    const polygon=await ports.polygon();if(token!==epoch)return;
    const geometry=selectedGeometry||root.DG_PARK_STAGE_GEOMETRY.clip(ring,ports.geometry(parent.park),polygon);
    status("Etap kaydediliyor…");
    const row=await ports.store.create(parent.row.id,label,geometry);if(token!==epoch)return;
    rows=[...rows.filter(r=>r.id!==row.id),row];
    const selected=await switchTo(root.DG_PARK_STAGE_GEOMETRY.candidate(row));
    if(!selected&&token===epoch)status("Etap kaydedildi. Çalışma kapsamını değiştirmek için listeden seçin.");
   }finally{setWorking(false,token);}
  }
  return Object.freeze({present,clear(){++epoch;drawing.cancel();assisted.clear();menu.clear();host=null;working=false;editing=false;},isDrawing:()=>editing});
 }
 root.DG_PARK_STAGE_WORKSPACE_UI=Object.freeze({create});
})(window);
