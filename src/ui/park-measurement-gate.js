"use strict";
/* Render measurement park-gate feedback from the application decision. */
(function(root){
function renderGate({result,box,save,escape:esc,formatArea,schemaWarningHTML}){
  if(result.status==="schema-unavailable"){
    if(box){box.style.display="block";box.className="alert warn";box.innerHTML=schemaWarningHTML();}
    if(save)save.disabled=false;
    return {allowed:true,redirect:null};
  }
  const p=result.project;
  if(result.status==="gate-unavailable")return {allowed:result.allowed,redirect:null};
  if(result.status==="editing"){
    box.style.display="none";
    if(save)save.disabled=false;
    return {allowed:true,redirect:null};
  }
  if(result.status==="project-required"){
    box.style.display="block";box.className="alert err";
    box.innerHTML=
      `<b>⛔ Ölçüm için park algılanmış bir proje gerekli.</b><br>`+
      `<span style="font-size:.82rem">Park algılama ekranına git → parkı seç → proje adı otomatik `+
      `"<b>Göksu Parkı - deneme</b>" biçiminde oluşsun.</span>`+
      `<div style="margin-top:10px"><button class="btn sm blue" onclick="startParkScan({returnTo:'measure'})">🌳 Park Algılama Ekranına Git</button></div>`;
    if(save)save.disabled=true;
    return {allowed:false,redirect:result.redirect};
  }
  if(result.status==="park-required"){
    box.style.display="block";box.className="alert err";
    box.innerHTML=result.isAdmin
      ? `<b>⛔ Bu projede park algılanmadı — ölçüm girilemez.</b><br>`+
        `<span style="font-size:.82rem">Proje: <b>${esc(p.name)}</b>. `+
        `Park kimliği olmadan girilen ölçümler karşılaştırmada park bazında izlenemez; `+
        `bu yüzden önce park kimliği oluşturuluyor.</span>`+
        `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">`+
          `<button class="btn sm blue" onclick="go('admin')">🔐 Yönetim → Park Kimlikleri</button>`+
        `</div>`
      : `<b>⛔ Bu proje parka bağlı değil — ölçüm girilemez.</b><br>`+
        `<span style="font-size:.82rem">Proje: <b>${esc(p.name)}</b>. Mevcut projeyi parka bağlama yetkisi `+
        `<b>yalnız yöneticide</b> 🔐. İki yol: (1) yönetici park atamasını Yönetim → Park Kimlikleri'nden yapsın, `+
        `(2) aşağıdan park algılayıp <b>yeni proje</b> aç ve ölçümlere orada devam et.</span>`+
        `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">`+
          `<button class="btn sm blue" onclick="startParkScan({returnTo:'measure'})">🌳 Park Algıla → Yeni Proje Oluştur</button>`+
        `</div>`;
    if(save)save.disabled=true;
    return {allowed:false,redirect:result.redirect};
  }
  box.style.display="block";box.className="alert ok";
  box.innerHTML=
    `<div class="measure-park-summary"><span><b>🌳 ${esc(result.parkName)}</b>`+
    (result.areaM2?` · ${formatArea(result.areaM2)}`:``)+
    `</span><button class="btn sm ghost" onclick="startParkScan({projectId:${p.id},returnTo:'measure'})">Parkı değiştir</button></div>`;
  if(save)save.disabled=false;
  return {allowed:true,redirect:null};
}
root.DG_PARK_MEASUREMENT_GATE_UI=Object.freeze({render:renderGate});
})(window);
