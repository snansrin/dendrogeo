"use strict";

/* Delegate admin tree/measurement filters to their established controllers. */
(function(root){
 function getElement(id){return root.document?.getElementById(id)||null;}
 function hasTree(element){return !!(element?.querySelector?.(".dg-tree-park,.dg-tree-sum,.alert.err,.alert.info"));}
 function showLoading(element,message){if(element)element.innerHTML=`<div class="alert info">⏳ ${message}</div>`;}
 function showLoadError(element,message,escape){
  if(element)element.innerHTML=`<div class="alert err"><b>⚠ Ağaç çizilemedi</b> <span class="mono" style="font-size:.72rem">${escape(message)}</span> <button class="btn sm blue" data-dg-admin-tree-action="load">🔄 Yeniden dene</button></div>`;
 }
 function updateBadge(count){
  const badge=getElement("adminPendingBadge");if(!badge?.style)return;
  if(count>0){badge.style.display="inline-block";badge.textContent=count>99?"99+":String(count);}
  else{badge.style.display="none";badge.textContent="";}
 }
 function setStatusValue(value){const select=getElement("treeStatus");if(select)select.value=value;}
 async function toggleProjectLock(id){
  if(!Number.isSafeInteger(id)||id<1)return;
  const{data:project,error:readError}=await window.DG_PERSIST_MEASUREMENT_PROJECT.lockStatus({client:sb,id});
  if(readError||!project)return toast("Proje okunamadı: "+(readError?.message||id),"err");
  const locking=!project.is_locked,phrase=(locking?"KİLİTLE PROJE ":"KİLİDİ AÇ PROJE ")+id;
  if(window.prompt(`${project.name} (#${id})\n${locking?'Kilitli projede ölçüm, ölçüm noktası, silme ve moderasyon engellenecek.':'Kilidi açmak projeyi yeniden düzenlemeye açar.'}\nYazılı onay: ${phrase}`)!==phrase)return;
  const{data,error}=await window.DG_PERSIST_MEASUREMENT_PROJECT.setLock({client:sb,id,locked:locking});
  if(error||!data)return toast("Kilit işlemi reddedildi: "+(error?.message||"Durum başka oturumda değişti."),"err");
  toast(locking?"🔒 Proje kilitlendi · Salt okunur":"🔓 Proje kilidi kaldırıldı","ok");
  if(typeof loadProjects==="function")await loadProjects();
  if(typeof loadAdminTree==="function")await loadAdminTree();
 }
 function bind(){
  if(root._dgAdminTreeActionsBound)return;
  root._dgAdminTreeActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-admin-tree-action]');
   if(!element)return;
   switch(element.dataset.dgAdminTreeAction){
    case "only-pending":root.dgTreeOnlyPending();break;
    case "open-pending":root.dgTreeOpenPending();break;
    case "load":root.loadAdminTree();break;
    case "expand-all":root.dgTreeExpand(true);break;
    case "collapse-all":root.dgTreeExpand(false);break;
    case "delete-project":root.dgTreeDeleteProject(event,Number(element.dataset.projectId));break;
    case "project-lock":event.preventDefault();void toggleProjectLock(Number(element.dataset.projectId));break;
    case "scan-park":root.dgTreePendingScan(event);break;
   }
  });
  document.addEventListener("input",event=>{
   const element=event.target?.closest?.('[data-dg-admin-tree-action]');
   if(element?.dataset.dgAdminTreeAction==="query")root.dgTreeSetQuery(element.value);
   if(element?.dataset.dgAdminTreeAction==="filter-measurements")root.filterAdminMeas();
  });
  document.addEventListener("change",event=>{
   const element=event.target?.closest?.('[data-dg-admin-tree-action="status"]');
   if(element)root.dgTreeSetStatus(element.value);
  });
  document.addEventListener("toggle",event=>{
   const element=event.target?.closest?.("details[data-dg-admin-tree-node]");
   if(element)root.dgTreeToggle(element.dataset.dgAdminTreeNode,element.open);
  },true);
 }
 root.DG_ADMIN_TREE_ACTIONS=Object.freeze({bind,getElement,hasTree,showLoading,showLoadError,updateBadge,setStatusValue});
})(window);

window.DG_ADMIN_TREE_ACTIONS.bind();
