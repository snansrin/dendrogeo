"use strict";

/* Preserve admin user rows, protected owner rows and read-only administrator controls. */
(function(root){
 function updateCounts(document,counts){
  const values={aUsersTotal:counts.total,aUsersActive:counts.active,aUsersAdmin:counts.admins,aUsersPassive:counts.passive};
  for(const [id,value] of Object.entries(values)){const element=document.getElementById(id);if(element)element.textContent=value;}
 }
 function render(element,users,{isOwner=false,escape=value=>String(value)}={}){
 element.innerHTML=users.map(x=>{
  const ownerRow=x.role==="owner";
  const roleBadge=ownerRow?'<span class="badge admin-user-role owner">KURUCU</span>':(x.role==="admin"?'<span class="badge admin admin-user-role">DENETÇİ</span>':'<span class="badge on admin-user-role">KULLANICI</span>');
  const label=(x.full_name||x.email||"?").trim(),initials=label.split(/\s+/).slice(0,2).map(v=>v[0]||"").join("").toLocaleUpperCase("tr-TR")||"?";
  const person=`<div class="admin-user-person"><span class="admin-user-avatar" aria-hidden="true">${escape(initials)}</span><span class="admin-user-identity"><strong>${escape(x.full_name)||"İsimsiz kullanıcı"}</strong><small>${escape(x.email)||"—"}</small></span></div>`;
  let act="";
  if(ownerRow)act="<span class='admin-user-lock'>🛡 Korunuyor</span>";
  else if(isOwner)act=`<div class="admin-user-actions"><select class="admin-user-role-select" aria-label="Kullanıcı rolü" data-dg-admin-user-action="role" data-dg-user-id="${escape(x.id)}"><option value="user" ${x.role==="user"?"selected":""}>Kullanıcı</option><option value="admin" ${x.role==="admin"?"selected":""}>Denetçi</option></select><button type="button" class="btn sm ${x.active?"red":"blue"}" data-dg-admin-user-action="toggle" data-dg-user-id="${escape(x.id)}" data-dg-user-active="${!x.active}">${x.active?"Pasifleştir":"Aktifleştir"}</button></div>`;
  else act="<span class='admin-user-lock'>Salt okunur</span>";
  return `<tr data-role="${escape(x.role||"user")}" data-status="${x.active?"active":"passive"}"><td data-label="Kullanıcı">${person}</td><td data-label="Rol">${roleBadge}</td><td data-label="Durum"><span class="badge ${x.active?"on":"off"}">${x.active?"Aktif":"Pasif"}</span></td><td data-label="İşlem">${act}</td></tr>`;
 }).join("");
 }
 root.DG_ADMIN_USER_TABLE_UI=Object.freeze({render,updateCounts});
})(window);
