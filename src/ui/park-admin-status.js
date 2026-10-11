"use strict";
/* Render park administration loading and result states without owning decisions. */
(function(root){
function backfillOffline(box){
  if(!box)return;
  box.style.display="block";
  box.innerHTML='<div class="alert err">⛔ Park geri doldurma internet gerektirir (OSM/Overpass sorgusu).</div>';
}

function backfillLoadFailed(box,error,escapeHTML){
  if(!box)return;
  box.style.display="block";
  box.innerHTML=`<div class="alert err">⚠ Projeler okunamadı: <span class="mono">${escapeHTML(error.message)}</span></div>`;
}

function backfillNoTargets(box){
  if(!box)return;
  box.style.display="block";
  box.innerHTML='<div class="alert ok">✓ Park bağı eksik proje yok — hepsi bir parka bağlı.</div>';
}

function parkLoadFailed(box,error,escapeHTML){
  if(!box)return;
  box.innerHTML=`<div class="alert err">⚠ Parklar okunamadı: <span class="mono">${escapeHTML(error.message)}</span></div>`;
}

function parkLoading(box){
  if(!box)return;
  box.innerHTML='<div class="alert info">⏳ Park kimlikleri yükleniyor…</div>';
}

root.DG_PARK_ADMIN_STATUS_UI=Object.freeze({
  backfillOffline,
  backfillLoadFailed,
  backfillNoTargets,
  parkLoadFailed,
  parkLoading
});
})(window);
