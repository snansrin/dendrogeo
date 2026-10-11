"use strict";
/* Render the existing park-schema fallback warning from supplied capability state. */
(function(root){
function renderParkSchemaWarning({available}){
  if(available)return "";
  return `<div class="alert warn" style="margin:6px 0"><b>⚠ Park kimliği devre dışı:</b> veritabanında `+
    `<span class="mono">public.parks</span> yok. <span class="mono">supabase/migrations/0004_parks.sql</span> `+
    `çalıştırılana kadar karşılaştırma proje adı bazında kalır ve ölçüm kapısı uygulanamaz.</div>`;
}

root.DG_PARK_SCHEMA_WARNING_UI=Object.freeze({render:renderParkSchemaWarning});
})(window);
