"use strict";

window.DG_RETRACTION_REQUEST_ERROR = (() => {
  function message(result) {
    const text = String(result.txt || "");
    if (!result.status || /^NETWORK/.test(text)) return "Ağ hatası: " + text.replace(/^NETWORK\s*/, "").slice(0, 160);
    if (/does not exist|42P01/i.test(text) || result.status === 404) return "Geri çekme kuyruğu kurulu değil: Supabase SQL Editor'da 0010_report_retraction.sql çalıştırılmalı.";
    if (/RETRACT_BAD_ID|DG0RF/i.test(text)) return "Rapor kimliği geçersiz (DGR-YYYY-NNNN bekleniyor).";
    if (/RETRACT_DUPLICATE|DG0RD|duplicate key|23505/i.test(text)) return "Bu rapor için bekleyen bir geri çekme isteği zaten var.";
    if (/RETRACT_QUOTA|DG0RQ/i.test(text)) return "Günlük geri çekme sınırına ulaştın (24 saatte 3) — sonra yeniden dene.";
    if (/RETRACT_NOT_YOUR_PARK|DG0RP/i.test(text)) return "Bu park senin projene bağlı değil — yalnız kendi parkının yayınını geri çekebilirsin.";
    if (/RETRACT_NOT_SELF|DG0RN/i.test(text)) return "Geri çekme isteği yalnız kendi adına açılabilir.";
    if (/RETRACT_INACTIVE|DG0RI/i.test(text)) return "Hesabın etkin değil.";
    if (/42501|401|403|row-level|permission/i.test(text)) return "Yetki yok: bu rapor için geri çekme isteği açamazsın.";
    return "İstek yazılamadı (HTTP " + result.status + "): " + text.slice(0, 160);
  }

  return Object.freeze({ message });
})();
