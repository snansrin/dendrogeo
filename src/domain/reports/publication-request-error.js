"use strict";

window.DG_PUBLICATION_REQUEST_ERROR = (() => {
  function message(result, translate = value => value) {
    const text = String(result.txt || "");
    if (!result.status || /^NETWORK/.test(text)) return "Ağ hatası: " + text.replace(/^NETWORK\s*/, "").slice(0, 160);
    if (/does not exist|42P01/i.test(text) || result.status === 404) return "0008_report_publish.sql çalıştırılmalı (report_requests tablosu yok).";
    if (/duplicate key|23505/i.test(text)) return translate("Bu park için bekleyen bir istek zaten var — kuyruktaki iş bitsin.");
    if (/REPORT_QUOTA|DG0QT/i.test(text)) return "Günlük yayın isteği sınırına ulaştın (24 saatte 3) — sonra yeniden dene.";
    if (/REPORT_NOT_YOUR_PARK|DG0NP/i.test(text)) return "Bu park senin projene bağlı değil — yalnız kendi parkının raporunu yayınlayabilirsin.";
    if (/REPORT_NO_OWN_DATA|DG0ND/i.test(text)) return "Bu parkta onaylı ölçümün yok — ölçümlerin yönetici onayından geçince yayın isteyebilirsin.";
    if (/REPORT_NOT_SELF|DG0NS/i.test(text)) return "Yayın isteği yalnız kendi adına açılabilir.";
    if (/REPORT_NO_DATA|DGR0RD|22023/i.test(text)) return "Bu parkta onaylı ölçüm yok; rapor üretilemez.";
    if (/42501|401|403|row-level|permission/i.test(text)) return "Yetki yok: bu park için yayın isteği açamazsın.";
    return "İstek yazılamadı (HTTP " + result.status + "): " + text.slice(0, 160);
  }

  return Object.freeze({ message });
})();
