"use strict";
/* An additive project selector for the existing live map. All writes, scans,
 * scientific acceptance and stage revisions remain in their original tools. */
(function(root){
 function create(ports){
  const doc=ports.document,host=doc.getElementById("dgLiveProjects"),select=doc.getElementById("dgLiveProjectSelect"),
   status=doc.getElementById("dgLiveProjectStatus"),actions=doc.getElementById("dgLiveProjectActions"),
   heading=doc.getElementById("dgLiveProjectActive");
  if(!host||!select||!status||!actions||!heading)return Object.freeze({refresh:()=>{}});
  let active=0,working=false,initialRestored=false;
  const t=(template,values={})=>typeof ports.translate==="function"?ports.translate(template,values):Object.entries(values).reduce((out,[key,value])=>out.replaceAll("{"+key+"}",String(value)),template);
  function note(message,type="info"){status.textContent=message;status.dataset.status=type;}
  function projects(){return (ports.projects()||[]).filter(row=>Number.isSafeInteger(Number(row.id))&&Number(row.id)>0);}
  function selected(){return projects().find(row=>Number(row.id)===Number(select.value)&&Number(row.park_id)>0);}
  function busy(value){working=value;host.setAttribute("aria-busy",String(value));host.querySelectorAll("button,select").forEach(el=>{el.disabled=value;});}
  function refresh(){
   if(working)return;
   const current=select.value,rows=projects();select.replaceChildren();
   const empty=doc.createElement("option");empty.value="";empty.textContent=t("Proje seç");select.append(empty);
   for(const project of rows){const item=doc.createElement("option");item.value=String(project.id);item.disabled=!Number(project.park_id);item.textContent=project.name+(project.shared?" "+t("· paylaşılan"):"")+(item.disabled?" "+t("· park bağlantısı yok"):"");select.append(item);}
   const available=rows.filter(row=>Number(row.park_id)>0);
   if(active&&!available.some(row=>Number(row.id)===active&&Number(row.park_id)===ports.activeParkId())){
    ports.clearWaypoints();active=0;heading.textContent="";actions.hidden=true;
   }
   const remembered=ports.remembered(),keep=available.some(row=>String(row.id)===current)?current:available.some(row=>String(row.id)===String(remembered))?String(remembered):"";
   select.value=keep;actions.hidden=!active||!rows.some(row=>Number(row.id)===active);
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
    let parent=null;
    if(park.geom_json?.stage_scope){
     const parentId=Number(park.geom_json.stage_scope.parentId);
     if(!Number.isSafeInteger(parentId)||parentId<=0||parentId===park.id)throw Error(t("Etap ana park kimliği geçersiz."));
     parent=await ports.readPark(parentId);ports.candidate(parent);
    }
    if(active!==Number(project.id)||ports.activeParkId()!==Number(park.id)){
     const saved=await ports.saveDraft();if(!saved)throw Error(t("Açık yüzey taslağı kaydedilemedi. Harita değiştirilmedi."));
     // Stage view needs the parent scope even when opened directly from a
     // fresh session. This initializes only the existing editor, not its data.
     if(parent)await ports.prepareParent(parent);
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
    heading.textContent=project.name+(project.is_locked?" "+t("· kilitli"):"");actions.hidden=!!project.is_locked;
    note(project.is_locked?t("{n} ölçüm noktası salt okunur görüntülendi. Kilitli proje yeni saha çalışmasının hedefi yapılamaz.",{n:points.length}):t("{n} kayıtlı ölçüm noktası yüklendi. Etap sınırı ve varsa kabul edilmiş yüzey sonucu mevcut araçlarla düzenlenebilir.",{n:points.length}),"ok");
   }catch(error){note(t("Proje açılamadı: {error}",{error:String(error.message||error)}),"err");}
   finally{busy(false);}
  }
  host.addEventListener("click",event=>{
   const control=event.target.closest?.("[data-live-project-action]");if(!control||control.disabled)return;
   const action=control.dataset.liveProjectAction;
   if(action==="open")void open();
   else if(action==="refresh")void (async()=>{if(working)return;busy(true);try{await ports.reloadProjects();}catch(error){note(t("Proje listesi yenilenemedi: {error}",{error:error.message}),"err");}finally{busy(false);refresh();}})();
   else if(action==="waypoints"&&active)ports.openWaypoints(active);
   else if(action==="surface"&&active)ports.openSurface();
   else if(action==="stages"&&active)ports.openStages();
  });
  select.addEventListener("change",()=>{if(!working){actions.hidden=true;note(t("Seçilen projeyi haritada açarak kayıtlarını görüntüleyebilirsin."));}});
  const mapView=doc.getElementById("v-map");
  function entering(){if(!mapView?.classList.contains("on"))return;refresh();if(!initialRestored&&ports.projects()?.length){initialRestored=true;const remembered=ports.remembered();if(remembered&&!ports.activeParkId()&&String(select.value)===String(remembered))void open();}}
  if(mapView&&typeof ports.observe==="function")ports.observe(mapView,entering);
  entering();
  return Object.freeze({refresh,open});
 }
 root.DG_LIVE_MAP_PROJECT_WORKSPACE_UI=Object.freeze({create});
})(window);
