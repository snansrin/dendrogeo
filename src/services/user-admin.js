"use strict";
/* DendroGeo · services/user-admin.js — KULLANICI YÖNETİMİ (Faz 6)
 * admin.js'ten birebir taşındı: liste, arama, rol değiştirme, askıya alma. */

let USERS_CACHE=[];

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadUsers(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadUsers__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadUsers__scroll(){
 return await window.DG_LOAD_ADMIN_USERS.execute(PROFILE,{
  load:()=>window.DG_USER_ADMIN_STORE.load(sb),
  onFailure:error=>toast("Kullanıcı listesi alınamadı: "+error.message,"err"),
  apply:users=>{USERS_CACHE=users;},
  summarize:users=>window.DG_USER_ADMIN_SUMMARY.summarize(users),
  updateCounts:counts=>window.DG_ADMIN_USER_TABLE_UI.updateCounts(document,counts),
  render:(users,isOwner)=>window.DG_ADMIN_USER_TABLE_UI.render($("aUsersT"),users,{isOwner,escape:esc}),
  filter:()=>filterUsers()
 });
}

function filterUsers(){
 const visible=window.DG_ADMIN_USER_FILTER_UI.apply($("aUsersT"),{
  query:$("userSearch")?.value||"",
  role:$("userRoleFilter")?.value||"",
  status:$("userStatusFilter")?.value||""
 });
 window.DG_ADMIN_USER_FILTER_UI.updateVisible(document,visible);
}

async function updateRole(id,role){
 if(PROFILE.role!=="owner")return toast("🛡 Bu yetki yalnızca kurucuya aittir.");
 const{error}=await window.DG_USER_ADMIN_STORE.setRole(sb,id,role);
if(error){toast("Hata: "+error.message,"err");return;}loadUsers();
}

async function toggleU(id,act){
 if(PROFILE.role!=="owner")return toast("🛡 Bu yetki yalnızca kurucuya aittir.");
 const{error}=await window.DG_USER_ADMIN_STORE.setActive(sb,id,act);
 if(error){toast("Hata: "+error.message,"err");return;}
 loadUsers();
}
