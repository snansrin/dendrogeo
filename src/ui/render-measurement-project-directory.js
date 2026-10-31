"use strict";

/* Render project selectors/cards and delegate card actions to injected workflows. */
const projectActionsBound=new WeakSet(),projectActionsByContainer=new WeakMap();
async function changeProjectLock(id,locked){
  const project=(typeof PROJ_LIST!=="undefined"?PROJ_LIST:[]).find(row=>Number(row.id)===id);
  if(!project||!!project.is_locked===locked)return;
  const phrase=(locked?"KİLİTLE PROJE ":"KİLİDİ AÇ PROJE ")+id;
  const entered=window.prompt(`${project.name} (#${id})\n${locked?'Kilit sonrası ölçümler, noktalar ve proje bilgileri salt okunur olacaktır.':'Kilit kaldırılırsa proje yeniden ölçüme açılır.'}\nDevam etmek için aynen yazın: ${phrase}`);
  if(entered!==phrase)return;
  const{data,error}=await window.DG_PERSIST_MEASUREMENT_PROJECT.setLock({client:sb,id,locked});
  if(error||!data)return toast("Proje kilidi değiştirilemedi: "+(error?.message||"Proje başka oturumda değiştirilmiş."),"err","🔒");
  if(locked)for(const key of ["mProject","nProject"]){const select=document.getElementById(key);if(select?.value===String(id))select.value="";}
  toast(locked?"🔒 Proje kilitlendi · Salt okunur":"🔓 Proje kilidi kaldırıldı","ok","🔒");
  await loadProjects();
}
function bindProjectActions(container,actions){
  if(!container)return;
  projectActionsByContainer.set(container,actions||{});
  if(projectActionsBound.has(container))return;
  projectActionsBound.add(container);
  container.addEventListener("click",event=>{
    const control=event.target?.closest?.("[data-project-action]");
    if(!control||!container.contains(control)||control.disabled)return;
    if(control.dataset.projectAction==="locked")return toast("🔒 Proje kilitli · Yeni ölçüm için aktif bir proje seçin.","info","🔒");
    if(control.dataset.projectAction==="lock"||control.dataset.projectAction==="unlock"){
      void changeProjectLock(Number(control.dataset.projectId),control.dataset.projectAction==="lock");return;
    }
    const action=projectActionsByContainer.get(container)?.[control.dataset.projectAction];
    if(typeof action==="function")action(Number(control.dataset.projectId),control,event);
  });
}
window.DG_MEASUREMENT_PROJECT_DIRECTORY_UI={
  render({projects,element,escape,optionLabel,restore,renderCard,editing,actions}){
    const rows=projects||[];
    const options=rows.map(project=>`<option value="${project.id}" ${project.is_locked?'disabled data-locked="true"':project.park_id?'translate="no"':`data-i18n-text="⛔ {name} (park yok)" data-i18n-values="${escape(JSON.stringify({name:project.name||""}))}"`}>${project.is_locked?'🔒 ':''}${escape(optionLabel(project))}${project.is_locked?' · Salt okunur':''}</option>`).join("");
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
