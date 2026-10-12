"use strict";
(function(root){
 function render(x,{escape,latin,thumbnail}){
  const st=x.status||"Beklemede";
  const bc=st==="Onaylı"?"on":(st==="Red"?"off":"admin");
  const act=st==="Onaylı"
   ?`<button class="btn sm red" onclick="rejectMeas(${x.id})">🚫 Reddet</button>`
   :`<button class="btn sm" onclick="approveMeas(${x.id})">✓ Onayla</button>`;
  return `<tr data-mid="${escape(x.id)}"><td data-label="Kullanıcı">${escape(x.profiles?.full_name)||"—"}</td><td data-label="Nokta">${x.point_id}</td><td data-label="Tür">${escape(x.species)}<br><span class="mono" style="font-size:.68rem;color:var(--mut);text-transform:none;letter-spacing:0">${escape(latin[x.species])||""}</span></td><td data-label="DBH"><b>${Number.isFinite(+x.dbh_cm)?(+x.dbh_cm).toFixed(1):"—"}</b></td><td data-label="Boy"><b>${x.height_m}</b></td><td data-label="Karbon">${(x.carbon_kg||0).toFixed(1)}</td><td data-label="Foto">${thumbnail(x.photo_url)}</td><td data-label="Durum"><span class="badge ${bc}">${st}</span></td><td data-label="İşlem" style="display:flex;gap:4px">${act}<button class="btn sm ghost" title="Konum çiti istisnası işle (0007 · yalnız yönetici · audit izi kalır)" onclick="dgGeoOverride(${x.id})">🛰</button><button class="btn sm red" onclick="delMeas(${x.id})">🗑️</button></td></tr>`;
 }
 root.DG_ADMIN_MEASUREMENT_ROW_UI=Object.freeze({render});
})(window);
