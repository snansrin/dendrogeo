"use strict";
/* One parent-scoped workspace; switching never reuses the parent's record ID. */
(function(root){
 function create(ports){
  let base=null,rows=[],current=null,host=null,epoch=0,ready=false,deleteReady=false,editing=false,working=false,proposals=[],preview=null,previewIndex=-1,draftName="",partCount=2,freeDrawing=false,cutEditing=false,editSource=null;
  const canDelete=row=>{const actor=ports.actor?.();return !!(deleteReady&&row&&base&&Number(row.geom_json?.stage_scope?.parentId)===Number(base.row.id)&&(actor?.admin||actor?.id&&actor.id===row.created_by));};
  const sameParentKey=(stage,parent)=>!!(stage?.geom_json?.stage_scope?.parentKey&&
   stage.geom_json.stage_scope.parentKey===parent?.osm_key&&stage.created_by&&stage.created_by===parent?.created_by&&!parent?.geom_json?.stage_scope);
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
   between:async(cuts,{detailed}={})=>{const parent=ports.geometry(base.park),polygon=await ports.polygon();return (detailed?root.DG_PARK_STAGE_BOUNDARY_PATHS.between:root.DG_PARK_STAGE_CUT_GEOMETRY.betweenCuts)(parent,cuts,{polygon,clip:root.DG_PARK_STAGE_GEOMETRY.clip});},padding:()=>menu.cutPadding(),onProgress:progress=>menu.cutProgress(progress),
   onInvalid:()=>{preview=null;menu.cutReady(false);render();status("Sınır referanslarını ayarlayın.");},onCancel:()=>{preview=null;cutEditing=false;menu.hideCuts();menu.hideHint();render();},onPreview:result=>{preview=result;proposals=[];render();showHint();status("Seçili alan: "+area(result.geometry)+" ha.");}});
  const area=geometry=>(ports.area(geometry)/10000).toFixed(2);
  function showHint(){if(cutEditing){menu.cutReady(true);return;}menu.showHint("Seçili bölüm: "+area(preview.geometry)+" ha",()=>{menu.open();host?.querySelector("#dgStageName")?.focus();},()=>void action("cancel"));}
  function selectProposal(index){if(working||!proposals[index])return;previewIndex=index;preview=proposals[index];assisted.show(preview);showHint();render();}
  function render(){
   if(!host)return;
   if(!base){
    // An archived stage can outlive its parent park. Keep the original
    // Etaplar tab in place, but never offer geometry edits without that park.
    const label=current?.row?.geom_json?.stage_scope?.label||current?.row?.name||"";
    host.innerHTML=`<div class="dg-png-title">Etap yönetimi</div><p class="dg-meta">${ports.escape(label)}</p>`+
     `<p id="dgStageStatus" class="dg-meta" role="status" aria-live="polite">Aktif çalışma alanı: kaydedilmiş kullanıcı tanımlı etap poligonu. Bu etabın grid, ölçüm ve yüzey araçları standart menülerdedir. Ana park kaydı eksik. Bu nedenle yalnız etap sınırını yeniden düzenleme kapalıdır; etabın kendisi çalışma alanı olarak kullanılabilir.</p>`;
    menu.refresh();return;
   }
   draftName=host.querySelector("#dgStageName")?.value??draftName;
   host.innerHTML=root.DG_PARK_STAGE_VIEW.render({escape:ports.escape,baseName:base.row.name,rows,selectedId:current?.row?.id===base.row.id?null:current?.row?.id,ready,editing,status:"",proposals,previewIndex,previewArea:preview?area(preview.geometry):null,draftName,partCount,canSave:!!preview||freeDrawing,revision:!!editSource,canDelete:canDelete(rows.find(row=>row.id===current?.row?.id))});menu.refresh();
  }
  async function present({park,row}){
   const token=++epoch;drawing.cancel();assisted.clear();menu.clear();proposals=[];preview=null;draftName="";freeDrawing=false;cutEditing=false;editSource=null;editing=false;working=false;current={park,row};
   if(!row){base=null;return;}
   const scope=row.geom_json?.stage_scope;
   if(!scope){base={park,row};rows=[];}
   else if(base?.row.id!==scope.parentId&&!sameParentKey(row,base?.row)){base=null;rows=[];}
   const panel=ports.document.getElementById("parkInfo");if(!panel)return;
   host=ports.document.createElement("section");host.id="dgParkStageWorkspace";host.className="dg-png-card dg-stage-workspace";
   host.setAttribute("aria-label","Etap seçimi");host.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-stage-action]");if(!button||button.disabled)return;
    const token=epoch;void action(button.dataset.stageAction).catch(error=>{if(token===epoch)status(error.message||"Etap işlemi tamamlanamadı.");});
   });host.addEventListener("change",event=>{if(event.target.id==="dgStageProposal"&&event.target.value!=="")selectProposal(Number(event.target.value));if(event.target.id==="dgStageSelect"){const button=host.querySelector('[data-stage-action="revise"]');if(button)button.disabled=!ready||event.target.value==="whole";const remove=host.querySelector('[data-stage-action="delete"]');if(remove)remove.disabled=!canDelete(rows.find(row=>String(row.id)===event.target.value));}});menu.mount(host);ready=false;deleteReady=false;render();
   if(!base)return;
   try{
    const [available,list,removeAvailable]=await Promise.all([ports.store.ready(),ports.store.list(base.row.id),ports.store.deleteReady?.()||false]);
    if(token!==epoch)return;ready=available;deleteReady=removeAvailable;rows=list.filter(r=>r.geom_json?.stage_scope?.parentId===base.row.id);
    // Legacy stage keeps its immutable ID and original project measurements.
    // Only show it alongside stages of the re-created parent with the same key/owner.
    if(scope&&sameParentKey(row,base.row)&&!rows.some(item=>Number(item.id)===Number(row.id)))rows.push(row);
    render();
   }catch(error){if(token===epoch)status("Etap listesi alınamadı: "+error.message);}
  }
  async function switchTo(candidate){
   const token=epoch;
   const activate=root.DG_ACTIVATE_STAGE_SCOPE.create({isBusy:ports.isBusy,validate:ports.validate,approveTransition:ports.approveTransition,isCurrent:()=>token===epoch,
    draw:async value=>{drawing.cancel();assisted.clear();menu.hideHint();menu.hideCuts();await ports.clearAnalysis();if(token!==epoch)return false;return ports.draw(value);}});
   return activate(candidate);
  }
  async function action(name){
   if(working)return;
   if(name==="cancel"){drawing.cancel();assisted.clear();menu.hideHint();menu.hideCuts();preview=null;proposals=[];freeDrawing=false;cutEditing=false;editSource=null;editing=false;render();return;}
   if(ports.isBusy()){status("Önce açık harita/yüzey işlemini tamamlayın; fırça, sınır çizimi, nesne seçimi veya harita ölçümünü kapatın.");return;}
   if(name==="delete"){
    const target=editSource||rows.find(row=>String(row.id)===host.querySelector("#dgStageSelect")?.value);if(!canDelete(target))throw Error("Yalnız kendi boş etabınızı veya yönetici olarak boş etabı silebilirsiniz.");
    if(!ports.confirmDelete(target))return;const token=epoch,wasActive=current.row.id===target.id,parent=base;setWorking(true);
    try{if(wasActive&&await ports.approveTransition()===false)return;if(token!==epoch)return;await ports.store.remove(target);if(token!==epoch)return;ports.forgetStage?.(target.osm_key);rows=rows.filter(row=>row.id!==target.id);drawing.cancel();assisted.clear();menu.hideCuts();menu.hideHint();preview=null;editSource=null;editing=false;cutEditing=false;proposals=[];
     if(wasActive){await ports.clearAnalysis();if(token!==epoch)return;await ports.draw(parent.park);}else{render();status("Etap silindi. Ana park ve kayıtlı veriler korundu.");}
    }finally{setWorking(false,token);}return;
   }
   if(editSource&&["suggest","draw","pick"].includes(name))throw Error("Etap düzenlemede yalnız başlangıç ve bitiş hatları değiştirilir.");
   if(name==="edit"){if(!ready)return;editSource=null;editing=true;render();host.querySelector("#dgStageName")?.focus();return;}
   if(name==="revise"){if(!ready)return;const value=host.querySelector("#dgStageSelect")?.value;editSource=rows.find(row=>String(row.id)===value);if(!editSource)throw Error("Düzenlemek için kayıtlı bir etap seçin.");editing=true;draftName=String(editSource.geom_json.stage_scope.label).slice(0,65)+" · düzenleme";render();name="pick-detail";}
   if(name==="pick"||name==="pick-detail"){
    const detailed=true,initial=editSource?root.DG_PARK_STAGE_BOUNDARY_PATHS.recover(ports.geometry(base.park),editSource.geom_json):null;
    drawing.cancel();assisted.clear();menu.hideHint();preview=null;proposals=[];freeDrawing=false;cutEditing=true;render();menu.close();const token=epoch;
    const run=name=>void action(name).catch(error=>{if(token===epoch)status(error.message);});
    menu.showCuts({name:draftName,detailed,revision:!!editSource,onName:value=>{draftName=value;const input=host?.querySelector("#dgStageName");if(input)input.value=value;},select:index=>assisted.selectBoundary(index),selectPoint:index=>assisted.selectPoint(index),deletePoint:()=>assisted.deletePoint(),undo:()=>assisted.undo(),reset:()=>assisted.resetBoundary(),save:()=>run("save"),remove:canDelete(editSource)?()=>run("delete"):null,cancel:()=>void action("cancel")});assisted.start(initial,detailed);
    if(editSource&&!initial)status("İki sınır hattı ayrılamadı. Başlangıç ve bitişi yeniden yerleştirin; ana park değişmez.");return;
   }
   if(name==="suggest"){
    drawing.cancel();assisted.clear();menu.hideHint();menu.hideCuts();cutEditing=false;freeDrawing=false;const token=epoch;partCount=Number(host.querySelector("#dgStagePartCount")?.value||2);preview=null;proposals=[];render();setWorking(true);
    try{const polygon=await ports.polygon();if(token!==epoch)return;
     proposals=root.DG_PARK_STAGE_CUT_GEOMETRY.suggest(ports.geometry(base.park),partCount,{polygon,clip:root.DG_PARK_STAGE_GEOMETRY.clip}).map(result=>({...result,areaLabel:area(result.geometry)+" ha"}));
     previewIndex=-1;preview=null;render();assisted.showProposals(proposals,selectProposal);status(proposals.length+" bölüm hazır. Haritadan veya listeden çalışacağınız bölümü siz seçin.");
    }finally{setWorking(false,token);}return;
   }
   if(name==="draw"){assisted.clear();menu.hideCuts();cutEditing=false;preview=null;proposals=[];freeDrawing=true;render();drawing.start();menu.close();menu.showHint("Haritada köşeleri seçin.",()=>menu.open(),()=>void action("cancel"));return;}
   if(name==="undo"){drawing.undo();return;}
   if(name==="apply"){
    const value=host.querySelector("#dgStageSelect").value;
    if(value!=="whole"&&!ready)throw Error("Sunucu etap koruması etkin olmadan etapla çalışılamaz.");
    const candidate=value==="whole"?base.park:root.DG_PARK_STAGE_GEOMETRY.candidate(rows.find(r=>String(r.id)===value));
    if((value==="whole"&&current.row.id===base.row.id)||String(current.row.id)===value)return;
    const token=epoch;setWorking(true);status("Çalışma kapsamı değiştiriliyor…");try{await switchTo(candidate);}finally{setWorking(false,token);}return;
   }
   if(name!=="save"||!ready)return;
   if(!preview&&!freeDrawing)throw Error("Önce bir bölüm seçin veya iki sınırın referanslarını tamamlayın.");
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
  return Object.freeze({present,open:()=>menu.open(),clear(){++epoch;drawing.cancel();assisted.clear();menu.clear();host=null;working=false;editing=false;cutEditing=false;editSource=null;},isDrawing:()=>editing});
 }
 root.DG_PARK_STAGE_WORKSPACE_UI=Object.freeze({create});
})(window);
