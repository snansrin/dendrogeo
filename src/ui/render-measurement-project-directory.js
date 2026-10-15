"use strict";

/* Render project selectors/cards and delegate card actions to injected workflows. */
const projectActionsBound=new WeakSet(),projectActionsByContainer=new WeakMap();
function bindProjectActions(container,actions){
  if(!container)return;
  projectActionsByContainer.set(container,actions||{});
  if(projectActionsBound.has(container))return;
  projectActionsBound.add(container);
  container.addEventListener("click",event=>{
    const control=event.target?.closest?.("[data-project-action]");
    if(!control||!container.contains(control)||control.disabled)return;
    const action=projectActionsByContainer.get(container)?.[control.dataset.projectAction];
    if(typeof action==="function")action(Number(control.dataset.projectId),control,event);
  });
}
window.DG_MEASUREMENT_PROJECT_DIRECTORY_UI={
  render({projects,element,escape,optionLabel,restore,renderCard,editing,actions}){
    const rows=projects||[];
    const options=rows.map(project=>`<option value="${project.id}">${escape(optionLabel(project))}</option>`).join("");
    const empty="<option value=''>Önce park algıla → proje oluştur</option>";
    for(const id of ["mProject","nProject"]){const select=element(id);if(select)select.innerHTML=options||empty;}
    restore();
    const own=rows.filter(project=>!project.shared),shared=rows.filter(project=>project.shared);
    const ownCount=element("projOwnCount"),sharedCount=element("projSharedCount");
    if(ownCount)ownCount.textContent=String(own.length);
    if(sharedCount)sharedCount.textContent=String(shared.length);
    const ownList=element("projOwnList"),sharedList=element("projSharedList"),sharedSection=element("projSharedSection");
    if(ownList){ownList.innerHTML=own.length?own.map(project=>renderCard(project,false)).join(""):'<div class="project-empty"><b>Henüz kendi projen yok.</b><span>Canlı Harita’dan bir park algılayıp ilk çalışma alanını oluştur.</span></div>';bindProjectActions(ownList,actions);}
    if(sharedList){sharedList.innerHTML=shared.map(project=>renderCard(project,true)).join("");bindProjectActions(sharedList,actions);}
    if(sharedSection)sharedSection.style.display=shared.length?"":"none";
    const compatibilityTable=element("projTable");
    if(compatibilityTable){compatibilityTable.innerHTML=own.map(project=>renderCard(project,false)).join("")+shared.map(project=>renderCard(project,true)).join("");bindProjectActions(compatibilityTable,actions);}
    const create=element("projCreateDetails");if(create&&!editing)create.open=own.length===0;
  }
};
