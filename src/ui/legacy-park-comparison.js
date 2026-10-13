"use strict";
(function(root){
 function render(parks,max,{escape,translate}){
  return `<div class="alert warn" style="margin-bottom:10px"><b>⚠ Veritabanı şeması eski:</b> park kimliği tabloları yok, liste geçici olarak <b>proje adı</b> bazında. Kalıcı çözüm: <span class="mono">supabase/migrations/0004_parks.sql</span> Supabase SQL Editor'da çalıştırılmalı.</div>`+
   (parks.length?parks.map((park,index)=>`
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:8px 12px;background:var(--bg);border-radius:10px">
   <div class="mono" style="width:26px;height:26px;border-radius:50%;background:${index===0?"var(--green)":"var(--line)"};color:${index===0?"#fff":"var(--mut)"};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;flex:0 0 auto">${index+1}</div>
   <div style="flex:1;min-width:0">
    <div style="font-size:.85rem;font-weight:700">${escape(park.name)} ${index===0?'<span class="badge on">🏆 En İyi</span>':""}</div>
    <div style="font-size:.7rem;color:var(--mut)">${escape(park.city)} · ${park.n} ${translate("kayıt")} · ${translate("ort. çap")} ${(park.dbh/park.n).toFixed(1)} cm · ${translate("ort. boy")} ${(park.h/park.n).toFixed(1)} m</div>
   </div>
   <div style="width:120px;background:var(--line);border-radius:4px;height:8px;overflow:hidden;flex:0 0 auto"><div style="height:100%;width:${(park.c/max*100).toFixed(0)}%;background:var(--green)"></div></div>
   <div class="mono" style="width:70px;text-align:right;font-weight:600;flex:0 0 auto">${(park.c/1000).toFixed(2)} t</div>
  </div>`).join(""):'<div style="color:var(--mut);font-size:.85rem">Henüz onaylı kayıt yok.</div>');
 }
 function reportOptions(parks,escape){return parks.map(park=>`<option>proj:${escape(park.name)}</option>`).join("")||'<option value="">—</option>';}
 root.DG_LEGACY_PARK_COMPARISON_UI=Object.freeze({render,reportOptions});
})(window);
