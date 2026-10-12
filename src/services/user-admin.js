"use strict";
/* DendroGeo · services/user-admin.js — KULLANICI YÖNETİMİ (Faz 6)
 * admin.js'ten birebir taşındı: liste, arama, rol değiştirme, askıya alma. */

let USERS_CACHE=[];

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadUsers(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadUsers__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadUsers__scroll(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return;
 const I_AM_OWNER=PROFILE.role==="owner";
 const{data,error}=await window.DG_USER_ADMIN_STORE.load(sb);
 if(error){toast("Kullanıcı listesi alınamadı: "+error.message,"err");return;}
 USERS_CACHE=data||[];
 const counts=window.DG_USER_ADMIN_SUMMARY.summarize(USERS_CACHE);
 if($("aUsersTotal"))$("aUsersTotal").textContent=counts.total;
 if($("aUsersActive"))$("aUsersActive").textContent=counts.active;
 if($("aUsersAdmin"))$("aUsersAdmin").textContent=counts.admins;
 if($("aUsersPassive"))$("aUsersPassive").textContent=counts.passive;
 window.DG_ADMIN_USER_TABLE_UI.render($("aUsersT"),USERS_CACHE,{isOwner:I_AM_OWNER,escape:esc});
 filterUsers();
}

function filterUsers(){
 const visible=window.DG_ADMIN_USER_FILTER_UI.apply($("aUsersT"),{
  query:$("userSearch")?.value||"",
  role:$("userRoleFilter")?.value||"",
  status:$("userStatusFilter")?.value||""
 });
 if($("aUsersVisible"))$("aUsersVisible").textContent=visible+" kullanıcı";
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
