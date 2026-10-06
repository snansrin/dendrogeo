"use strict";
/* DendroGeo · services/user-admin.js — KULLANICI YÖNETİMİ (Faz 6)
 * admin.js'ten birebir taşındı: liste, arama, rol değiştirme, askıya alma. */

let USERS_CACHE=[];

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadUsers(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadUsers__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadUsers__scroll(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return;
 const I_AM_OWNER=PROFILE.role==="owner";
 const{data}=await sb.from("profiles").select("*");
 USERS_CACHE=data||[];
 const total=USERS_CACHE.length,active=USERS_CACHE.filter(x=>x.active).length;
 if($("aUsersTotal"))$("aUsersTotal").textContent=total;
 if($("aUsersActive"))$("aUsersActive").textContent=active;
 if($("aUsersAdmin"))$("aUsersAdmin").textContent=USERS_CACHE.filter(x=>x.role==="admin"||x.role==="owner").length;
 if($("aUsersPassive"))$("aUsersPassive").textContent=total-active;
 $("aUsersT").innerHTML=USERS_CACHE.map(x=>{
  const ownerRow=x.role==="owner";
  const roleBadge=ownerRow?'<span class="badge admin-user-role owner">KURUCU</span>':(x.role==="admin"?'<span class="badge admin admin-user-role">DENETÇİ</span>':'<span class="badge on admin-user-role">KULLANICI</span>');
  const label=(x.full_name||x.email||"?").trim(),initials=label.split(/\s+/).slice(0,2).map(v=>v[0]||"").join("").toLocaleUpperCase("tr-TR")||"?";
  const person=`<div class="admin-user-person"><span class="admin-user-avatar" aria-hidden="true">${esc(initials)}</span><span class="admin-user-identity"><strong>${esc(x.full_name)||"İsimsiz kullanıcı"}</strong><small>${esc(x.email)||"—"}</small></span></div>`;
  let act="";
  if(ownerRow)act="<span class='admin-user-lock'>🛡 Korunuyor</span>";
  else if(I_AM_OWNER)act=`<div class="admin-user-actions"><select class="admin-user-role-select" aria-label="Kullanıcı rolü" onchange="updateRole('${x.id}',this.value)"><option value="user" ${x.role==="user"?"selected":""}>Kullanıcı</option><option value="admin" ${x.role==="admin"?"selected":""}>Denetçi</option></select><button class="btn sm ${x.active?"red":"blue"}" onclick="toggleU('${x.id}',${!x.active})">${x.active?"Pasifleştir":"Aktifleştir"}</button></div>`;
  else act="<span class='admin-user-lock'>Salt okunur</span>";
  return `<tr data-role="${esc(x.role||"user")}" data-status="${x.active?"active":"passive"}"><td data-label="Kullanıcı">${person}</td><td data-label="Rol">${roleBadge}</td><td data-label="Durum"><span class="badge ${x.active?"on":"off"}">${x.active?"Aktif":"Pasif"}</span></td><td data-label="İşlem">${act}</td></tr>`;
 }).join("");
 filterUsers();
}

function filterUsers(){
 const q=($("userSearch")?.value||"").trim().toLocaleLowerCase("tr-TR");
 const role=$("userRoleFilter")?.value||"";
 const status=$("userStatusFilter")?.value||"";
 let visible=0;
 $("aUsersT").querySelectorAll("tr").forEach(r=>{
  const text=(r.textContent||"").toLocaleLowerCase("tr-TR");
  const show=(!q||text.includes(q))&&(!role||r.dataset.role===role)&&(!status||r.dataset.status===status);
  r.style.display=show?"":"none"; if(show)visible++;
 });
 if($("aUsersVisible"))$("aUsersVisible").textContent=visible+" kullanıcı";
}

async function updateRole(id,role){
 if(PROFILE.role!=="owner")return toast("🛡 Bu yetki yalnızca kurucuya aittir.");
 const{error}=await sb.from("profiles").update({role}).eq("id",id);
if(error){toast("Hata: "+error.message,"err");return;}loadUsers();
}

async function toggleU(id,act){
 if(PROFILE.role!=="owner")return toast("🛡 Bu yetki yalnızca kurucuya aittir.");
 await sb.from("profiles").update({active:act}).eq("id",id);loadUsers();
}
