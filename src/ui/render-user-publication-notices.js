"use strict";

window.DG_RENDER_USER_PUBLICATION_NOTICES = (() => {
  function render(state, escape) {
    const own = state.ownApproved === 0
      ? '<div class="alert warn" style="margin-top:10px">⚠ Bu projede <b>onaylı ölçümün görünmüyor</b>. Yayın isteği, parkta onaylı ölçümün varsa açılır — ölçülerin yönetici onayından geçince 📄 düğmesi çalışır.</div>'
      : (state.ownApproved > 0 ? '<div class="dg-tree-meta" style="margin-top:8px">✓ Bu projede ' + Number(state.ownApproved) + " onaylı ölçümün var.</div>" : "");
    const offline = state.queue === null
      ? '<div class="dg-tree-meta" style="margin-top:8px">ℹ Yayın günlüğü okunamadı (çevrimdışı ya da dosya henüz yayınlanmadı) — istek gönderimi çalışır, durum alanı eksik kalabilir.</div>' : "";
    const guidance = '<div class="dg-parkadmin-note" style="margin-top:10px">Rapor <b>park düzeyindedir</b>: yalnız bu projeyi değil, parktaki <b>tüm onaylı ölçümleri</b> kapsar. '
      + "Yayın kalıcıdır — içerik hash'i ile dondurulur, eski rapor DEĞİŞMEZ; yeni çözümleme yeni DGR kimliği alır. "
      + "Üretim birkaç dakika sürer (kuyruk işi 5 dakikada bir çalışır); bağlantı bu panelde belirir. Yönetici olmayan kullanıcı 24 saatte en fazla 3 istek açabilir. "
      + "🗑 Geri çek = yanlışlıkla yayımlanan rapor yayından kaldırılır: adresinde gerekçeli bildirim kalır, kimlik yeniden kullanılmaz, işlem günlüğe yazılır.</div>";
    return own + offline + guidance;
  }

  return Object.freeze({ render });
})();
