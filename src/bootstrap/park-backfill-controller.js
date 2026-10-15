"use strict";

/* Park backfill composition root. Search, planning, writes and feedback stay
 * in their feature modules; this controller binds ports and legacy actions. */
(function(root){
 function create(deps){
  let plan=null;
  const sleep=ms=>new Promise(resolve=>deps.setTimeout(resolve,ms));
  async function queryParkSafe(lat,lon,radius){
   if(deps.window.DG_QUERY_PARK_SAFELY)return deps.window.DG_QUERY_PARK_SAFELY.query(lat,lon,radius,{queryPark:deps.queryPark,warn:(distance,error)=>deps.warn("DENDROGEO · park sorgusu ("+distance+" m) başarısız:",error)});
   try{return await deps.queryPark(lat,lon,radius);}catch(error){deps.warn("DENDROGEO · park sorgusu ("+radius+" m) başarısız:",error);return null;}
  }
  const search=deps.window.DG_OSM_PARK_NAME_SEARCH_ADAPTER.create({normalizeName:deps.normalizeLoose,request:deps.overpassRequest,extractRings:deps.extractRings,polyArea:deps.polyArea});
  async function queryParkByName(lat,lon,name){return search(lat,lon,name);}
  const detect=deps.window.DG_BACKFILL_PARK_DETECTION_APPLICATION.create({queryNear:queryParkSafe,queryByName:queryParkByName,sleep});
  async function detectParkForProject(lat,lon,name){return detect(lat,lon,name);}
  function progress(index,total,label){return deps.window.DG_PARK_BACKFILL_PROGRESS_UI.render({box:deps.element("backfillBox"),index,total,label,escape:deps.escape});}
  const planUseCase=deps.window.DG_PARK_BACKFILL_PLAN_APPLICATION.create({
   isAdmin:deps.isAdmin,isOnline:deps.isOnline,
   fetchProjects:()=>deps.window.DG_PARK_PROJECT_READ_STORE.fetchBackfillProjects(deps.getClient()),
   fetchMeasurements:id=>deps.window.DG_PARK_PROJECT_READ_STORE.fetchMeasurements({client:deps.getClient(),projectId:id,limit:1000}),
   detectPark:detectParkForProject,sleep,suggestParkName:deps.suggestParkName,
   projectName:deps.projectName,labelFromLegacy:deps.labelFromLegacy,
   onProgress:progress
  });
  function renderPlan(){return deps.window.DG_PARK_BACKFILL_PLAN_UI.render({box:deps.element("backfillBox"),plan:plan||[],escape:deps.escape,formatArea:deps.formatArea,translateFormat:deps.translateFormat});}
  function closePlan(){deps.window.DG_PARK_BACKFILL_PLAN_UI.close(deps.document);plan=null;}
  async function backfillParks(){
   const result=await planUseCase(),box=deps.element("backfillBox");
   if(result.status==="forbidden")return deps.toast("Yetki yok.","err");
   if(result.status==="offline"){deps.window.DG_PARK_ADMIN_STATUS_UI.backfillOffline(box);return deps.toast("Çevrimdışı: park geri doldurma çalışmaz.","err","📴");}
   if(result.status==="projects-load-failed"){deps.window.DG_PARK_ADMIN_STATUS_UI.backfillLoadFailed(box,result.error,deps.escape);return deps.toast(deps.translateCommon("Projeler okunamadı: ")+deps.escape(result.error.message),"err");}
   if(result.status==="no-targets"){deps.window.DG_PARK_ADMIN_STATUS_UI.backfillNoTargets(box);return deps.toast("Park bağı eksik proje yok ✓","ok","🌳");}
   plan=result.plan;return renderPlan();
  }
  const apply=deps.window.DG_PARK_BACKFILL_APPLY_APPLICATION.create({isAdmin:deps.isAdmin,
   confirmApply:count=>deps.confirm(deps.translateFormat("{n} proje parkla eşleşecek ve adları yeniden kurulacak. Devam?",{n:count})),
   onProgress:progress,registerPark:deps.registerPark,linkProject:(project,park)=>linkProjectToPark(project,park)
  });
  async function applyBackfill(){
   const result=await apply(plan);
   if(result.status==="forbidden")return deps.toast("Yetki yok.","err");
   if(result.status==="empty-plan")return deps.toast("Uygulanacak eşleşme yok","warn");
   if(result.status==="cancelled")return;
   if(deps.window.DG_COMPLETE_PARK_BACKFILL_APPLY&&deps.window.DG_PARK_BACKFILL_APPLY_FEEDBACK_UI){
    deps.window.DG_COMPLETE_PARK_BACKFILL_APPLY.complete({result,showResult:value=>deps.window.DG_PARK_BACKFILL_APPLY_FEEDBACK_UI.show({result:value,translateFormat:deps.translateFormat,notify:deps.toast}),clearPlan:()=>{plan=null;},closePlan,refresh:deps.refreshAfterWrites});return;
   }
   deps.toast(deps.translateFormat("✓ {n} proje parkla eşleştirildi{f}",{n:result.successes,f:result.failures?deps.translateFormat(" · {n} hata",{n:result.failures}):""}),result.failures?"warn":"ok","🌳");plan=null;closePlan();deps.refreshAfterWrites();
  }
  async function linkProjectToPark(project,park){
   if(!deps.linkBackfillProject){
    const label=deps.labelFromLegacy(project.name,park.name),{error}=await deps.updateBackfillProject(project.id,{park_id:park.id,label});
    if(error){deps.warn("DENDROGEO · backfill proje hatası:",error.message);deps.toast(deps.translateCommon("Bağlanamadı (")+deps.escape(project.name)+"): "+deps.escape(error.message),"err");return false;}
    try{await deps.backfillMeasurements(project.id,park.id);}catch(error){}
    return true;
   }
   const result=await deps.linkBackfillProject(project,park);
   if(result.status==="write-failed"){deps.window.DG_PARK_BACKFILL_LINK_FEEDBACK_UI.failed({project,error:result.error,escape:deps.escape,translate:deps.translateCommon,warn:deps.warn,notify:deps.toast});return false;}
   return result.status==="linked";
  }
  const manual=deps.window.DG_PARK_BACKFILL_MANUAL_APPLICATION.create({isAdmin:deps.isAdmin,
   getPlanRow:id=>(plan||[]).find(row=>row.project.id===id),
   confirmCreate:({name,lat,lon})=>deps.confirm(deps.translateFormat("\"{name}\" adıyla elle park kimliği oluşturulsun ve proje bağlansın mı?\nKonum: ölçümlerin merkezi ({la}, {lo})",{name,la:lat.toFixed(5),lo:lon.toFixed(5)})),
   createPark:(name,row)=>deps.registerPark({name,source:"manual",area:null},{manual:true,lat:row.lat,lon:row.lon,source:"manual"}),
   linkProject:linkProjectToPark
  });
  async function backfillManual(projectId){
   const result=await manual(projectId);
   if(result.status==="forbidden")return deps.toast("Yetki yok.","err");
   if(result.status==="measurement-center-missing")return deps.toast("Bu proje için ölçüm merkezi yok.","err");
   if(result.status==="cancelled"||result.status==="project-link-failed")return;
   if(result.status==="park-create-failed")return deps.toast("Park kimliği oluşturulamadı.","err","🌳");
   if(deps.window.DG_COMPLETE_MANUAL_BACKFILL_PARK&&deps.window.DG_BUILD_MANUAL_BACKFILL_PARK_UPDATE&&deps.window.DG_PARK_BACKFILL_MANUAL_FEEDBACK_UI){
    deps.window.DG_COMPLETE_MANUAL_BACKFILL_PARK.complete({result,buildUpdate:(row,createdPark)=>deps.window.DG_BUILD_MANUAL_BACKFILL_PARK_UPDATE.build({row,park:createdPark,projectName:deps.projectName,labelFromLegacy:deps.labelFromLegacy}),updateRow:(row,patch)=>Object.assign(row,patch),showSuccess:park=>deps.window.DG_PARK_BACKFILL_MANUAL_FEEDBACK_UI.show({park,escape:deps.escape,notify:deps.toast}),renderPlan,refresh:deps.refreshAfterWrites});return;
   }
   const row=result.row,park=result.park;row.durum="eşleşti";row.parkName=park.name;row.yol="elle oluşturuldu";row.newName=deps.projectName(park.name,deps.labelFromLegacy(row.project.name,park.name));row.cand={name:park.name,area:park.area_m2};
   deps.toast("✓ "+deps.escape(park.name)+" oluşturuldu ve bağlandı","ok","🌳");renderPlan();deps.refreshAfterWrites();
  }
  return Object.freeze({queryParkSafe,queryParkByName,detectParkForProject,backfillParks,renderPlan,closePlan,applyBackfill,linkProjectToPark,backfillManual,getPlan:()=>plan});
 }
 root.DG_PARK_BACKFILL_CONTROLLER=Object.freeze({create});
})(window);
