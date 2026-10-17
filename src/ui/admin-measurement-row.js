"use strict";
(function(root){
 const bindings=new WeakSet(),actionsByElement=new WeakMap();
 function bind(element,actions){
  if(!element||typeof element.addEventListener!=="function")return;
  actionsByElement.set(element,actions||{});
  if(bindings.has(element))return;
  bindings.add(element);
  element.addEventListener("click",event=>{
   const control=event.target?.closest?.("[data-admin-measurement-action]");
   if(!control||!element.contains(control))return;
   const action=actionsByElement.get(element)?.[control.dataset.adminMeasurementAction];
   if(typeof action==="function")action(control);
  });
 }
 function render(x,{escape,latin,thumbnail}){
  const st=x.status||"Beklemede";
  const bc=st==="Onaylı"?"on":(st==="Red"?"off":"admin");
  const id=escape(x.id);
  const act=st==="Onaylı"
   ?`<button type="button" class="btn sm red" data-admin-measurement-action="reject" data-measurement-id="${id}">🚫 Reddet</button>`
   :`<button type="button" class="btn sm" data-admin-measurement-action="approve" data-measurement-id="${id}">✓ Onayla</button>`;
  return `<tr data-mid="${id}"><td data-label="Kullanıcı">${escape(x.profiles?.full_name)||"—"}</td><td data-label="Nokta">${x.point_id}</td><td data-label="Tür">${escape(x.species)}<br><span class="mono dg-latin-name" lang="la" style="font-size:.68rem;color:var(--mut);text-transform:none;letter-spacing:0">${escape(latin[x.species])||""}</span></td><td data-label="DBH"><b>${Number.isFinite(+x.dbh_cm)?(+x.dbh_cm).toFixed(1):"—"}</b></td><td data-label="Boy"><b>${x.height_m}</b></td><td data-label="Karbon">${(x.carbon_kg||0).toFixed(1)}</td><td data-label="Foto">${thumbnail(x.photo_url)}</td><td data-label="Durum"><span class="badge ${bc}">${st}</span></td><td data-label="İşlem" style="display:flex;gap:4px">${act}<button type="button" class="btn sm ghost" data-admin-measurement-action="geoOverride" data-measurement-id="${id}" title="Konum çiti istisnası işle (0007 · yalnız yönetici · audit izi kalır)">🛰</button><button type="button" class="btn sm red" data-admin-measurement-action="delete" data-measurement-id="${id}">🗑️</button></td></tr>`;
 }
 root.DG_ADMIN_MEASUREMENT_ROW_UI=Object.freeze({render,bind});
})(window);
