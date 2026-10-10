"use strict";
/* Draw park discovery and project controls from the supplied view state. */
(function(root){
function renderParkScanCard({element:el,park,candidate:cand,showManual,scanActive,schemaWarning,step,isAdmin,targetProjectId,projects,returnTo,escape:esc,formatArea:dgFmtHa,manualForm:dgManualFormHTML,labelFromLegacy:dgLabelFromLegacy,projectName:dgProjectName}){

  if(!scanActive&&!park&&!cand&&!showManual){
    el.style.display="none";
    el.innerHTML="";
    return;
  }

  el.style.display="block";

  const schemaWarn=schemaWarning;

  /* --- adım göstergesi --- */
  const steps=
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">`+
      `<b style="font-size:1rem">🌳 Park Algılama</b>`+
      `<span class="dg-scan-step${step>=1?" on":""}">1 · Parkı bul</span>`+
      `<span class="dg-scan-step${step>=2?" on":""}">2 · Kimliği doğrula</span>`+
      `<span class="dg-scan-step${step>=3?" on":""}">3 · Proje</span>`+
    `</div>`;

  /* --- 1) park henüz yok --- */
  if(!park&&!cand){
    el.innerHTML=schemaWarn+steps+
      `<div class="alert info" style="margin:6px 0">Haritada <b>parkın içine tıkla</b> — sınır ve ad otomatik algılanır. `+
      `Park modu kapalıysa aşağıdaki buton açar.</div>`+
      `<div style="display:flex;gap:8px;flex-wrap:wrap">`+
        `<button class="btn sm blue" onclick="dgToggleParkModeFromScan()">🌳 Park Modunu Aç</button>`+
        `<button class="btn sm" onclick="dgDetectAtMyLocation()">📍 Konumumdan Algıla</button>`+
      `</div>`+
      /* UZAKTAN PARK (2026-09-27 · kullanıcı isteği): "uzaktaki bir parka proje
       * oluşturamıyorum". GPS yalnızca ÖNERİ içindir; ada göre arama herhangi
       * bir yerdeki parkı bulur → proje açılabilir. ÖLÇÜM kapısı ayrı kalır:
       * saveMeas konum çitiyle parkta olmayı zorunlu tutar. */
      `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">`+
        `<input id="scanRemote" class="dg-png-input" placeholder="uzaktaki parkın adı (örn. Göksu Parkı, Mersin)" style="flex:1;min-width:200px">`+
        `<button class="btn sm blue" onclick="dgScanSearchByName(document.getElementById('scanRemote').value)">🔍 Ada göre bul (uzak park)</button>`+
      `</div>`+
      `<div class="dg-tree-meta" style="margin-top:6px">Uzak parkta <b>proje açabilirsin</b>; ölçüm ve fotoğraf için parkta olman gerekir (konum çiti 0007).</div>`+
      `<div style="display:flex;gap:8px;flex-wrap:wrap">`+
        `<button class="btn sm ghost" onclick="dgShowManualParkForm()">✍️ OSM'de yok — elle oluştur</button>`+
      `</div>`+
      dgManualFormHTML(showManual);
    return;
  }

  /* --- 2) park algılandı: kimlik + proje adımı --- */
  const nm=esc((park&&park.name)||(cand&&cand.name)||"İsimsiz Park");
  const ha=dgFmtHa((park&&park.area_m2)||(cand&&cand.area));
  const ident=park
    ? `DB #${park.id} · ${esc(park.osm_key||"")}`
    : `<span style="color:var(--red)">kimlik sunucuya yazılamadı</span>`;

  /* Parka BAĞLAMA araçları yalnız yöneticiye görünür (0006 + kullanıcı isteği).
   * Normal kullanıcı yalnız "yeni proje oluştur" görür. */
  const admin=isAdmin;
  const target=(admin&&targetProjectId)
    ? (projects||[]).find(p=>p.id===targetProjectId)
    : null;

  const others=admin
    ? (projects||[]).filter(p=>!p.park_id&&(!target||p.id!==target.id))
    : [];

  el.innerHTML=schemaWarn+steps+
    `<div class="alert ${park?"ok":"err"}" style="margin:6px 0">`+
      `<b>${nm}</b> · ${ha} · <span class="mono" style="font-size:.72rem">${ident}</span>`+
      (park?`<br><span style="font-size:.78rem">Bu park artık sistemde TEK kimlik: başkaları aynı parkı algıladığında veriler bu satırda birleşir.</span>`
           :`<br><button class="btn sm amber" onclick="dgRetryRegister()">🔄 Kimliği yeniden yaz</button>`)+
    `</div>`+


    `<div class="grid g2" style="gap:10px">`+
      `<div>`+
        `<div class="lbl">PROJE ETİKETİ (opsiyonel)</div>`+
        `<input id="scanLabel" class="dg-png-input" placeholder="örn. deneme" oninput="dgScanPreviewName()" value="${esc(target?dgLabelFromLegacy(target.name,(park&&park.name)||""):"")}">`+
        `<div class="lbl" style="margin-top:8px">PROJE ADI</div>`+
        `<div id="scanNamePreview" class="mono" style="font-size:.85rem;padding:6px 0">${esc(dgProjectName((park&&park.name)||"",target?dgLabelFromLegacy(target.name,park&&park.name):""))}</div>`+
      `</div>`+
      `<div style="display:flex;flex-direction:column;gap:8px;justify-content:center">`+
        `<button class="btn blue" onclick="dgScanCreateProject()">📁 Yeni proje oluştur</button>`+
        (admin
          ? ``
          : `<div class="dg-tree-meta">🔐 Bu ekrandan yalnızca <b>yeni proje</b> açılır. `+
            `Mevcut projelere park atamasını yönetici <b>Yönetim → Park Kimlikleri</b>'nden yapar.</div>`)+
        (scanActive&&returnTo
          ? `<button class="btn sm ghost" onclick="dgCancelScan()">Vazgeç</button>`
          : ``)+
      `</div>`+
    `</div>`;
}

root.DG_PARK_SCAN_CARD_UI=Object.freeze({render:renderParkScanCard});
})(window);
