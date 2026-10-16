/* Render supplied archive history without changing stored entries. */
export function createReportHistoryPresentation({esc}) {
  return function renderHistory({M, snap, id}) {
  /* ---- Rapor geçmişi ---- */
  const hist = [...(M.history || []).map((h) => ({ ...h, cur: false })), { id, date: snap.generated_at.slice(0, 10), note: snap.presentation_correction?.note || 'İlk yayımlama', cur: true }];
  const histRows = hist.map((h) => `<tr${h.cur ? ' style="font-weight:700"' : ''}><td><code>${esc(h.id)}</code></td><td>1.0</td><td>${esc(h.date || '—')}</td><td class="tr">${esc(h.note || '')}${h.cur ? ' (bu raporun yayımlanan anlık görüntüsü)' : ''}</td></tr>`).join('');

    return histRows;
  };
}
