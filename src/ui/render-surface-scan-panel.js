"use strict";

/* Render scan status and scientific evidence disclosure. */
window.DG_RENDER_SURFACE_SCAN_PANEL={
  render({model,record,busy,rawView,brush,cellCount,auditHtml,translate,escape}){
    let html=`<div class="dg-sens-head"><div><div class="dg-png-kicker">🛰 ${escape(translate("Yüzey düzenleme"))}</div><p class="dg-sens-hint">${escape(translate("Tara, haritada ayarla, doğru gördüğün sonucu kaydet."))}</p></div><button id="dgSensScanBtn" type="button" class="dg-png-btn ${model.scanned?"ghost":"primary"} sm" onclick="dgSensScan()" ${model.disabled||rawView||brush?"disabled":""}>${busy?"⏳":model.scanned?"🔁":"🔍"} ${escape(translate(model.scanned?"Yeniden Tara":"Tara"))}</button></div>`;
    if(model.scanned){const dates=(record.profile.scenes||[]).filter(scene=>scene.usedCells>0).map(scene=>scene.datetime).sort();html+=`<p class="dg-sens-hint">Sentinel‑2 L2A · ${escape(dates[0]||"—")} – ${escape(dates.at(-1)||"—")} · ${record.profile.stats?.nProfiled||0}/${cellCount} ${escape(translate("hücre"))} · 10 / 20 m</p>`;html+=auditHtml(record);}
    html+=`<p class="dg-sens-hint">${escape(translate("Uydu altlığının tarihi bu tarihlerden farklı olabilir. Küçük bina, yol ve su alanları için sınır düzeltmesini kullanın."))}</p>`;
    return html;
  }
};
