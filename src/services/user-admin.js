"use strict";
/* DendroGeo · services/user-admin.js — KULLANICI YÖNETİMİ (Faz 6)
 * admin.js'ten birebir taşındı: liste, arama, rol değiştirme, askıya alma. */

let USERS_CACHE=[];

async function loadUsers(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return;
 const I_AM_OWNER=PROFILE.role==="owner";
 const{data}=await sb.from("profiles").select("*");
 USERS_CACHE=data||[];
 $("aUsersT").innerHTML=USERS_CACHE.map(x=>{
  const ownerRow=x.role==="owner";
  const roleBadge=ownerRow?'<span class="badge" style="background:var(--green-dk);color:#fff">KURUCU</span>':(x.role==="admin"?'<span class="badge admin">DENETÇİ</span>':'<span class="badge on">KULLANICI</span>');
  let act="";
  if(ownerRow)act="<span style='color:var(--mut);font-size:.7rem'>🛡 Korunuyor</span>";
  else if(I_AM_OWNER)act=`<select onchange="updateRole('${x.id}',this.value)" style="padding:4px;border-radius:6px;border:1px solid var(--line)"><option value="user" ${x.role==="user"?"selected":""}>Kullanıcı</option><option value="admin" ${x.role==="admin"?"selected":""}>Denetçi</option></select> <button class="btn sm ${x.active?"red":"blue"}" onclick="toggleU('${x.id}',${!x.active})">${x.active?"Pasifleştir":"Aktifleştir"}</button>`;
  else act="<span style='color:var(--mut);font-size:.7rem'>Salt okunur</span>";
  return `<tr><td>${esc(x.email)||"—"}</td><td>${esc(x.full_name)||"—"}</td><td>${roleBadge}</td><td><span class="badge ${x.active?"on":"off"}">${x.active?"Aktif":"Pasif"}</span></td><td style="display:flex;gap:6px;align-items:center">${act}</td></tr>`;
 }).join("");
}

function filterUsers(){
 const q=$("userSearch").value.toLowerCase();
 $("aUsersT").querySelectorAll("tr").forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?"":"none";});
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
