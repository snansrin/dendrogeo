"use strict";

/* Park administration composition root. Feature modules own their behavior;
 * this controller wires the current UI, stores and legacy public actions. */
(function(root){
 function create(deps){
  const state=deps.window.DG_PARK_ADMIN_STATE.create();
  let rows=[];
  let showEmpty=false;
  let lastContext=null;
  state.subscribe(snapshot=>{rows=snapshot.rows;showEmpty=snapshot.showEmpty;lastContext=snapshot.lastContext;});

  const mutationStore=deps.window.DG_PARK_ADMIN_MUTATION_STORE.create({getClient:deps.getClient});
  const syncProjectNames=deps.window.DG_SYNC_PARK_PROJECT_NAMES_ADAPTER.create({getClient:deps.getClient});
  const refresh=()=>deps.window.DG_REFRESH_PARK_ADMIN_VIEWS.refresh({
   loadParkAdmin:api.loadParkAdmin,
   loadProjects:deps.loadProjects,
   loadWorld:deps.loadWorld,
   loadAdminTree:deps.loadAdminTree
  });

  async function loadParkAdmin(){
   const result=await deps.loadApplication();
   if(result.status==="forbidden")return deps.toast("Yetki yok.","err");
   const box=deps.element("parkAdminBox");
   if(result.status==="park-load-failed")return deps.window.DG_PARK_ADMIN_STATUS_UI.parkLoadFailed(box,result.error,deps.escape);
   state.setState({rows:result.parks});
   return renderParkAdmin(result.projects,result.measurements);
  }

  function renderParkAdmin(projects,measurements){
   if(!deps.element("parkAdminBox"))return;
   const snapshot=state.getState();
   if(snapshot.rows!==rows||snapshot.showEmpty!==showEmpty)state.setState({rows,showEmpty});
   return deps.window.DG_RENDER_PARK_ADMIN_UI.render({
    state,element:deps.element,projects,measurements,
    buildOverview:input=>deps.window.DG_PARK_ADMIN_OVERVIEW.build(input),
    renderRows:input=>deps.window.DG_PARK_ADMIN_RENDERER.render({...input,actions:{
     mergeInto:element=>api.parkMergeInto(Number(element.dataset.sourceId),Number(element.dataset.targetId)),
     toggleEmpty:()=>api.toggleEmpty(),
     search:value=>api.updateView({query:value}),
     sort:value=>api.updateView({sort:value}),
     rename:element=>api.parkRename(Number(element.dataset.parkId)),
     backfillGeometry:element=>deps.backfillGeometry(Number(element.dataset.parkId)),
     mergeFromSelect:element=>api.parkMergeFromSelect(Number(element.dataset.parkId)),
     delete:element=>api.parkDelete(Number(element.dataset.parkId))
    }}),
    normalizeLoose:deps.normalizeLoose,normalizeName:deps.normalizeName,formatHectares:deps.formatHectares,
    distance:deps.distance,escapeHTML:deps.escape,translate:deps.translate,
    translateFormat:deps.translateFormat,translatePlain:deps.translatePlain
   });
  }

  async function parkRename(id){
   const rename=deps.window.DG_PARK_ADMIN_RENAME_APPLICATION.create({
    isAdmin:deps.isAdmin,getParks:()=>rows,
    promptName:park=>deps.window.DG_PARK_ADMIN_MUTATION_UI.promptRename(park,{prompt:deps.prompt,translate:deps.translate}),
    normalizeName:deps.normalizeName,
    updatePark:(parkId,patch)=>mutationStore.updatePark(parkId,patch),
    resyncProjectNames:syncProjectNames
   });
   const result=await rename(id);
   if(deps.window.DG_PARK_ADMIN_MUTATION_UI.renameResult(result,{translate:deps.translate,translateCommon:deps.translateCommon,escape:deps.escape,toast:deps.toast}))await afterChange();
  }

  function parkMergeFromSelect(id){
   const select=deps.element("parkMergeSel"+id),destination=select?+select.value:0;
   if(!destination)return deps.toast("Önce hedef park seç","err","🔀");
   return api.parkMergeInto(id,destination);
  }

  async function parkMergeInto(sourceId,destinationId){
   const merge=deps.window.DG_PARK_ADMIN_MERGE_APPLICATION.create({
    isAdmin:deps.isAdmin,getParks:()=>rows,
    confirmMerge:(source,destination)=>deps.window.DG_PARK_ADMIN_MUTATION_UI.confirmMerge(source,destination,{confirm:deps.confirm,translateFormat:deps.translateFormat}),
    moveProjects:(source,destination)=>mutationStore.moveProjects(source,destination),
    moveMeasurements:(source,destination)=>mutationStore.moveMeasurements(source,destination),
    resyncProjectNames:syncProjectNames,deletePark:id=>mutationStore.deletePark(id),clearSession:deps.clearParkSession
   });
   const result=await merge(sourceId,destinationId);
   if(deps.window.DG_PARK_ADMIN_MUTATION_UI.mergeResult(result,{translate:deps.translate,translateCommon:deps.translateCommon,translateFormat:deps.translateFormat,escape:deps.escape,toast:deps.toast}))await afterChange();
  }

  async function parkDelete(id){
   const remove=deps.window.DG_PARK_ADMIN_DELETE_APPLICATION.create({
    isAdmin:deps.isAdmin,getPark:parkId=>rows.find(park=>park.id===parkId),
    confirmDelete:park=>deps.window.DG_PARK_ADMIN_MUTATION_UI.confirmDelete(park,{confirm:deps.confirm}),
    deletePark:parkId=>mutationStore.deletePark(parkId),clearSession:deps.clearParkSession
   });
   const result=await remove(id);
   if(deps.window.DG_PARK_ADMIN_MUTATION_UI.deleteResult(result,{escape:deps.escape,toast:deps.toast}))await afterChange();
  }

  async function afterChange(){return refresh();}
  function updateView(patch){
   state.setState(patch);
   const context=state.getState().lastContext||{projects:[],measurements:[]};
   return renderParkAdmin(context.projects,context.measurements);
  }
  function toggleEmpty(){
   if(deps.window.DG_TOGGLE_PARK_ADMIN_EMPTY)return deps.window.DG_TOGGLE_PARK_ADMIN_EMPTY.toggle(state,renderParkAdmin);
   showEmpty=!showEmpty;const context=lastContext||{projects:[],measurements:[]};return renderParkAdmin(context.projects,context.measurements);
  }
  const api={state,mutationStore,syncProjectNames,loadParkAdmin,renderParkAdmin,parkRename,parkMergeFromSelect,parkMergeInto,parkDelete,afterChange,toggleEmpty,updateView};
  return Object.freeze(api);
 }
 root.DG_PARK_ADMIN_CONTROLLER=Object.freeze({create});
})(window);
