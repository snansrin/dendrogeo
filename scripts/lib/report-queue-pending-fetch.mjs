// Fetch publication queue IDs first: completed reports remain "Beklemede" in
// Supabase because GitHub is read-only. Never download their large surface
// snapshots again merely to check whether new work exists.
export const REQUEST_COLUMNS_WITH_SURFACE = 'id,park_id,with_lulc,status,note,created_at,surface_snapshot';
export const REQUEST_COLUMNS_NO_SURFACE = 'id,park_id,with_lulc,status,note,created_at';
const PAGE_SIZE = 50;

function missingQueue() {
  const error = new Error("report_requests tablosu yok — Supabase SQL Editor'da 0008_report_publish.sql çalıştırılmalı");
  error.code = 'NO_TABLE';
  return error;
}

export async function fetchUnprocessedRequests(fetchPage, {limit = 50, processedIds = [], cutoff = null} = {}) {
  const processed = new Set(processedIds.map(String));
  const results = [];
  let offset = 0;
  let detailColumns = REQUEST_COLUMNS_WITH_SURFACE;

  while (results.length < limit) {
    // This cheap projection is enough to skip all previously published IDs.
    const probe = await fetchPage('id', PAGE_SIZE, offset, cutoff);
    if (probe.status === 404) throw missingQueue();
    if (!probe.ok) throw new Error('report_requests metadata HTTP ' + probe.status);
    const ids = await probe.json();
    if (!Array.isArray(ids)) throw new Error('Invalid report request ID page');

    if (ids.some(row => !processed.has(String(row.id)))) {
      // Only pages containing unprocessed IDs need snapshots. Keep the
      // existing order/offset and legacy schema fallback intact.
      let response = await fetchPage(detailColumns, PAGE_SIZE, offset, cutoff);
      if (response.status === 400 && detailColumns === REQUEST_COLUMNS_WITH_SURFACE) {
        detailColumns = REQUEST_COLUMNS_NO_SURFACE;
        response = await fetchPage(detailColumns, PAGE_SIZE, offset, cutoff);
      }
      if (response.status === 404) throw missingQueue();
      if (!response.ok) throw new Error('report_requests HTTP ' + response.status + ': ' + (await response.text()).slice(0, 200));
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid report request detail page');
      results.push(...rows.filter(row => !processed.has(String(row.id))));
    }

    if (ids.length < PAGE_SIZE) break;
    offset += ids.length;
  }
  return results.slice(0, limit);
}
