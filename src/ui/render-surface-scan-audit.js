"use strict";

/* Render evidence counts and disagreement hints without implying accuracy. */
window.DG_RENDER_SURFACE_SCAN_AUDIT={
  render({audit,translate,escape,meta,hectares,sectionsOpen}){
    if(!audit)return"";
    const dates=audit.scenes.map(scene=>scene.datetime).filter(Boolean),from=dates[0]?.slice(0,10)||audit.range?.start||"—",to=dates.at(-1)?.slice(0,10)||audit.range?.end||"—";
    const transitions=audit.transitions.length?audit.transitions.slice(0,8).map(item=>`<li>${escape(translate(meta(item.from).tr))} → ${escape(translate(meta(item.to).tr))}: ${item.cells} ${escape(translate("hücre"))} · ${hectares(item.areaM2)} ha</li>`).join(""):`<li>${escape(translate("Yeterli verili hücrelerde sınıf farkı görülmedi."))}</li>`;
    const agreement=audit.usable?`%${(100*audit.matched/audit.usable).toFixed(1)}`:"—";
    return `<details id="dgSensEvidenceDetails" class="dg-sens-details dg-sens-evidence" data-dg-toggle="rememberSection" ${sectionsOpen===false?"":"open"}><summary>${escape(translate("Uydu tarama analizi"))}<span class="dg-paint-chevron" aria-hidden="true">⌄</span></summary><div class="dg-sens-evidence-body"><p><b>Sentinel‑2 L2A · ${escape(from)} – ${escape(to)}</b> · ${audit.scenes.length} ${escape(translate("kullanılan sahne"))}${audit.skipped?` · ${audit.skipped} ${escape(translate("atlanan sahne"))}`:""}</p><p>${escape(translate("Analiz kapsamı"))}: ${audit.profiled} / ${audit.total} ${escape(translate("hücrede yeterli gözlem"))} · ${audit.usable} ${escape(translate("karşılaştırılabilir tahmin"))} · ${audit.ambiguous} ${escape(translate("belirsiz"))} · ${audit.missing} ${escape(translate("yetersiz/verisiz"))}</p><p>${escape(translate("2021 ham sınıfıyla spektral eşleşme"))}: ${agreement} (${audit.matched}/${audit.usable})</p><p><b>${escape(translate("Fark görülen sınıflar"))}</b></p><ul>${transitions}</ul><p class="dg-sens-hint">${escape(translate("Bu eşleşme bağımsız doğruluk ölçümü değildir: uydu indeksi, ham 2021 sınıfıyla karşılaştırılır. Tarama sınıfları otomatik değiştirmez; harita sınıfı için sınır/hücre düzeltmesini inceleyip Kabul et ve kaydet kullanın."))}</p></div></details>`;
  }
};
