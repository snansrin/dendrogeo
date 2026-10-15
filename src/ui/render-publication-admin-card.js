"use strict";

window.DG_RENDER_PUBLICATION_ADMIN_CARD = (() => {
  function schemaWarning() {
    return `<div class="alert warn">⚠ <b>Yayın kuyruğu veritabanında kurulu değil.</b> Supabase → SQL Editor'da <span class="mono">supabase/migrations/0008_report_publish.sql</span> çalıştırın, sonra bu kartı 🔄 Yenile ile açın. (Rapor motoru hazır; yalnız istek tablosu eksik.)</div>`;
  }

  function render(view) {
    const s = view.summary;
    return `<div class="admin-publish-summary">
      <div class="admin-publish-metric"><span>Aktif yayın</span><strong>${s.activeCount}</strong></div>
      <div class="admin-publish-metric"><span>Kuyrukta</span><strong>${s.pending}</strong></div>
      <div class="admin-publish-metric"><span>DOI kayıtlı</span><strong>${s.doiCount}</strong></div>
      <div class="admin-publish-metric"><span>Hata günlüğü</span><strong>${s.failedCount}</strong></div></div>
      ${view.error ? `<div class="alert err">⚠ ${view.escape(view.error)}</div>` : ""}
      ${view.queueMissing ? '<div class="alert info">ℹ Yayın günlüğü okunamadı (çevrimdışı ya da dosya henüz yayınlanmadı). İstek gönderimi çalışır; durum alanı boş kalır.</div>' : ""}
      ${s.failBanner}
      ${s.pending > 0 ? `<div class="alert info">⏳ <b>${s.pending} ${view.translate("istek kuyrukta.")}</b> ${view.translate("Başarısız üretimler en fazla 3 kez otomatik yeniden denenir. Başarılı rapor üretildikten sonra Zenodo DOI kaydı otomatik başlatılır.")}</div>` : ""}
      <div class="tblwrap admin-publish-table"><table class="dg-cards"><thead><tr><th scope="col">Park</th><th scope="col">Kayıt</th><th scope="col">Karbon</th><th scope="col">Alan</th><th scope="col">Yayın durumu</th><th scope="col">İşlem</th></tr></thead><tbody>
      ${view.rows || '<tr><td colspan="6">Onaylı ölçümü olan park yok — önce ölçüm onaylayın.</td></tr>'}
      </tbody></table></div>
      <details class="admin-publish-log"><summary><span>📜 Yayın günlüğü</span><small>son 6 işlem</small></summary><div class="admin-publish-log-list">
      ${view.history || '<div class="dg-tree-meta">Henüz işlenmiş istek yok. Günlük: <span class="mono">rapor/yayin-kuyrugu.json</span></div>'}
      </div></details>
      <details class="admin-publish-help"><summary>Yayın akışı ve değişmezlik kuralları</summary><div class="admin-publish-help-body">📄 Yayınla isteği kuyruğa yazar; rapor üretildiğinde DGR kimliği ve içerik hash'i dondurulur. Aktif üretim raporu için Zenodo DOI kaydı otomatik yürür. Eski rapor değiştirilmez; yeni çözümleme yeni DGR kimliği alır. 🗑 Geri çekme veri dosyalarını kaldırır ve kimliği yeniden kullandırmaz.</div></details>`;
  }

  function mount(box, html) {
    if (!box) return false;
    box.innerHTML = html;
    return true;
  }

  function updateClock(clock, value) {
    if (!clock) return false;
    clock.textContent = value || "—";
    return true;
  }

  function showLoading(document) {
    const box = document?.getElementById("dgPubBox");
    return mount(box, '<div class="dg-tree-meta">⏳ Kuyruk yükleniyor…</div>');
  }

  return Object.freeze({ schemaWarning, render, mount, updateClock, showLoading });
})();
