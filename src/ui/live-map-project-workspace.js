"use strict";
/* An additive project selector for the existing live map. All writes, scans,
 * scientific acceptance and stage revisions remain in their original tools. */
(function(root){
 function create(ports){
  const doc=ports.document,host=doc.getElementById("dgLiveProjects"),select=doc.getElementById("dgLiveProjectSelect"),
   status=doc.getElementById("dgLiveProjectStatus");
  if(!host||!select||!status)return Object.freeze({refresh:()=>{}});
  let active=0,working=false;
  const t=(template,values={})=>typeof ports.translate==="function"?ports.translate(template,values):Object.entries(values).reduce((out,[key,value])=>out.replaceAll("{"+key+"}",String(value)),template);
  function note(message,type="info"){status.textContent=message;status.dataset.status=type;}
  function projects(){return (ports.projects()||[]).filter(row=>Number.isSafeInteger(Number(row.id))&&Number(row.id)>0);}
  function hasSavedBoundary(row){return Array.isArray(row?.geom_json?.outer)&&row.geom_json.outer.some(ring=>Array.isArray(ring)&&ring.length>=4);}
  function selected(){return projects().find(row=>Number(row.id)===Number(select.value)&&Number(row.park_id)>0);}
  function busy(value){working=value;host.setAttribute("aria-busy",String(value));host.querySelectorAll("button,select").forEach(el=>{el.disabled=value;});}
  function refresh(){
   if(working)return;
   const current=select.value,rows=projects();select.replaceChildren();
   const empty=doc.createElement("option");empty.value="";empty.textContent=t("Proje seç");select.append(empty);
   for(const project of rows){const item=doc.createElement("option");item.value=String(project.id);item.disabled=!Number(project.park_id);item.textContent=project.name+(project.shared?" "+t("· paylaşılan"):"")+(item.disabled?" "+t("· park bağlantısı yok"):"");select.append(item);}
   const available=rows.filter(row=>Number(row.park_id)>0);
   if(active&&!available.some(row=>Number(row.id)===active&&Number(row.park_id)===ports.activeParkId())){
    ports.clearWaypoints();ports.stopWatching?.();active=0;
   }
   select.value=available.some(row=>String(row.id)===current)?current:"";
   if(!available.length)note(t("Haritada açılabilecek park bağlantılı proje bulunamadı. Parkı olmayan projeler listede korunur."));
   else if(!active)note(t("{n} haritada açılabilir proje hazır. Haritada açmak için seç.",{n:available.length}));
  }
  async function open(){
   if(working)return;
   const local=selected();if(!local)return note(t("Önce erişim yetkin olan bir proje seç."),"warn");
   if(ports.isEditing())return note(t("Açık etap çizimini, fırçayı veya harita ölçümünü tamamlayıp yeniden dene. Mevcut işlem korunuyor."),"warn");
   busy(true);note(t("Projenin park sınırı ve yetkileri doğrulanıyor…"));
   try{
    const project=await ports.readProject(local.id);
    if(!project||Number(project.park_id)!==Number(local.park_id)||!projects().some(row=>Number(row.id)===Number(project.id)))throw Error(t("Proje erişimi veya park bağlantısı değişti; listeyi yenile."));
    const park=await ports.readPark(project.park_id),candidate=ports.candidate(park);
    let parent=null,missingParent=false,reconnectedParent=false;
    if(park.geom_json?.stage_scope){
     const scope=park.geom_json.stage_scope,parentId=Number(scope.parentId);
     if(!Number.isSafeInteger(parentId)||parentId<=0||parentId===park.id)throw Error(t("Etap ana park kimliği geçersiz."));
     // A parent is optional for opening an immutable stage. Historical parent
     // records (and their OSM replacements) can exist without saved geometry;
     // that must never prevent loading the stage's own verified boundary.
     try{parent=await ports.readParent(parentId);}catch{parent=null;}
     if(parent&&!hasSavedBoundary(parent))parent=null;
     if(!parent&&typeof ports.readParentByKey==="function"&&typeof scope.parentKey==="string"&&park.created_by){
      let replacement=null;
      try{replacement=await ports.readParentByKey(scope.parentKey);}catch{replacement=null;}
      if(replacement&&Number(replacement.id)!==Number(park.id)&&!replacement.geom_json?.stage_scope&&
       replacement.osm_key===scope.parentKey&&replacement.created_by===park.created_by&&hasSavedBoundary(replacement)){
       parent=replacement;reconnectedParent=true;
      }
     }
     if(parent)ports.candidate(parent);
     else missingParent=true;
    }
    const changing=active!==Number(project.id)||ports.activeParkId()!==Number(park.id);
    if(changing){
     const saved=await ports.saveDraft();if(!saved)throw Error(t("Açık yüzey taslağı kaydedilemedi. Harita değiştirilmedi."));
     if(active&&ports.saveWorkspace)await ports.saveWorkspace(active,ports.activeParkId());
     // Stage view needs the parent scope even when opened directly from a
     // fresh session. This initializes only the existing editor, not its data.
     if(parent)await ports.prepareParent(parent);
     else if(missingParent)await ports.forgetParent(); // never reuse an old parent editor session
     note(t("Kaydedilmiş sınır haritaya yükleniyor…"));
     await ports.draw(candidate,park);
     if(ports.activeParkId()!==Number(park.id))throw Error(t("Harita seçilen park kimliğine bağlanamadı. Kayıtlar değiştirilmedi."));
    }
    note(t("Kayıtlı ölçüm noktaları yükleniyor…"));
    const points=await ports.readWaypoints(project.id);
    if(!projects().some(row=>Number(row.id)===Number(project.id)))throw Error(t("Proje erişimi güncellendi; yeniden deneyin."));
    ports.showWaypoints(points);
    if(!project.is_locked)ports.selectProject(project.id);
    active=Number(project.id);ports.remember(active);
    let restored=null,restoreError=null;
    if(changing&&ports.restoreWorkspace){
     note(t("Kayıtlı tarama, grid ve yüzey düzeltmeleri proje kapsamında aranıyor…"));
     try{restored=await ports.restoreWorkspace(project,park);}catch(error){restoreError=error;}
    }
    ports.watchWorkspace?.(project.id,park);
    ports.focusPark?.();
    if(restoreError)note(t("Etap ve {n} ölçüm noktası açıldı; çalışma görüntüsü yüklenemedi: {error}",{n:points.length,error:String(restoreError.message||restoreError)}),"warn");
    else if(restored?.mode==="cached")note(t("{n} ölçüm noktası, kaydedilmiş {g} grid hücresi ve {s} yüzey taraması kayıtlı arşivden geri açıldı.",{n:points.length,g:restored.grid||0,s:restored.scan?1:0})+(missingParent?" "+t("Ana park kaydı eksik; etap sınırı düzenlenemez."):reconnectedParent?" "+t("Etaplar menüsü doğrulanan ana parka yeniden bağlandı."):""),missingParent?"warn":"ok");
    else if(restored?.mode==="evidence-missing")note(t("Etap sınırı ve {n} ölçüm noktası açıldı. Yüzey düzeltmesi kaydı var, fakat orijinal tarama görüntüsü bu cihazda yok; yeni tarama yapılmadı.",{n:points.length})+(missingParent?" "+t("Ana park kaydı eksik; etap sınırı düzenlenemez."):""),"warn");
    else if(restored?.mode==="review")note(t("{n} ölçüm noktası ve kayıtlı yüzey düzeltmeleri otomatik hazırlandı. Yeni analiz kabul edilmedi.",{n:points.length})+(missingParent?" "+t("Ana park kaydı eksik; etap sınırı düzenlenemez."):reconnectedParent?" "+t("Etaplar menüsü doğrulanan ana parka yeniden bağlandı."):""),missingParent?"warn":"ok");
    else note(project.is_locked?t("{n} ölçüm noktası salt okunur görüntülendi. Kilitli proje yeni saha çalışmasının hedefi yapılamaz.",{n:points.length}):missingParent?t("{n} kayıtlı ölçüm noktası ve etap sınırı yüklendi. Ana park kaydı eksik; etap sınırı düzenlenemez, yüzey ve ölçüm kayıtları açılabilir.",{n:points.length}):reconnectedParent?t("{n} kayıtlı ölçüm noktası ve seçilen etap değişmeden açıldı. Etaplar menüsü doğrulanan ana parka yeniden bağlandı.",{n:points.length}):t("{n} kayıtlı ölçüm noktası yüklendi. Etap sınırı ve varsa kabul edilmiş yüzey sonucu mevcut araçlarla düzenlenebilir.",{n:points.length}),missingParent?"warn":"ok");
   }catch(error){ports.resumeWatching?.();note(t("Proje açılamadı: {error}",{error:String(error.message||error)}),"err");}
   finally{busy(false);}
  }
  host.addEventListener("click",event=>{
   const control=event.target.closest?.("[data-live-project-action]");if(!control||control.disabled)return;
   const action=control.dataset.liveProjectAction;
   if(action==="open")void open();
   else if(action==="refresh")void (async()=>{if(working)return;busy(true);try{await ports.reloadProjects();}catch(error){note(t("Proje listesi yenilenemedi: {error}",{error:error.message}),"err");}finally{busy(false);refresh();}})();
  });
  // Only a real user choice starts project loading. Programmatic refresh and
  // the initial placeholder never draw, scan or select a previously used park.
  select.addEventListener("change",()=>{if(!working){if(select.value)void open();else note(t("Haritada açmak için bir proje seç."));}});
  const mapView=doc.getElementById("v-map");
  function entering(){if(mapView?.classList.contains("on"))refresh();}
  if(mapView&&typeof ports.observe==="function")ports.observe(mapView,entering);
  entering();
  return Object.freeze({refresh,open});
 }
 root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI=Object.freeze({create});
})(window);
