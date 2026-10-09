/* Report author resolution.
 * The caller supplies the existing read adapter; source priority and fallback
 * behavior stay isolated from snapshot assembly and publication metadata.
 */
export async function resolveReportAuthor(parkId, rest) {
  let author = { name: null, full_name: null, source: 'unresolved' };
  const setName = (name, source) => { author = { name, full_name: name, source }; };

  try {
    const owner = await rest('rpc/dg_park_author', { park: parkId });
    if (owner && owner[0] && String(owner[0].full_name || '').trim())
      setName(String(owner[0].full_name).trim(), 'data_owner');
  } catch (error) { /* Migration 0015 may be absent; continue to request author. */ }

  if (!author.name) {
    try {
      const request = await rest('v_report_authors', {
        park_id: 'eq.' + parkId,
        order: 'created_at.desc',
        limit: '1',
      });
      if (request && request[0] && String(request[0].full_name || '').trim())
        setName(String(request[0].full_name).trim(), 'report_request');
    } catch (error) {
      author = {
        name: null,
        full_name: null,
        source: 'unavailable',
        note: String((error && error.message) || error).slice(0, 120),
      };
    }
  }

  return author;
}
