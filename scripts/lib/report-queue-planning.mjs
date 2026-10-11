export const RUN_LIMIT = 3;
export const REQUEST_RETRY_MAX = 3;

/* Pure planning rules: report identity validation is supplied by the caller. */
export function createReportQueuePlanner({isReportId}) {
/* ---------- PLAN (saf fonksiyon: test burayı kilitler) ---------- */
function requestAttemptState(entries,id){
  const key=String(id),xs=(entries||[]).filter(e=>String(e.request_id||"")===key);
  return {published:xs.some(e=>e.status==="Yayınlandı"),failures:xs.filter(e=>e.status==="Başarısız").length};
}
function effectiveProcessedRequestIds(entries,processedIds=[],maxAttempts=REQUEST_RETRY_MAX){
  const out=new Set((processedIds||[]).map(String));
  for(const e of entries||[]){
    const id=String(e.request_id||"");if(!id)continue;
    const st=requestAttemptState(entries,id);
    if(!st.published&&st.failures>0&&st.failures<maxAttempts)out.delete(id);
  }
  return [...out];
}
function planQueue(entries, requests, limit = RUN_LIMIT, processedIds = []) {
  const done = new Set(effectiveProcessedRequestIds(entries,processedIds));
  for(const e of entries||[]){
    const id=String(e.request_id||"");if(!id)continue;
    const st=requestAttemptState(entries,id);
    if(st.published||st.failures>=REQUEST_RETRY_MAX)done.add(id);
    else if(st.failures>0)done.delete(id);
  }
  const todo = (requests || []).filter((r) => !done.has(String(r.id)));
  return { todo: todo.slice(0, limit), skipped: todo.length > limit ? todo.length - limit : 0, already: (requests || []).length - todo.length };
}

function planRetractions(entries, retractions, limit = RUN_LIMIT) {
  const done = new Set((entries || []).filter((e) => e.status === 'Geri çekildi').map((e) => String(e.retraction_id)));
  const retractedReports = new Set((entries || []).filter((e) => e.status === 'Geri çekildi').map((e) => String(e.report_id)));
  const pub = new Map();
  for (const e of entries || [])
    if (e.status === 'Yayınlandı' && isReportId(String(e.report_id || ''))) pub.set(String(e.report_id), e);
  const valid = [], invalid = [];
  for (const rt of retractions || []) {
    if (!rt || !isReportId(String(rt.report_id || ''))) { invalid.push(rt); continue; }
    if (done.has(String(rt.id))) continue;
    const p = pub.get(String(rt.report_id));
    if (!p || retractedReports.has(String(rt.report_id))) continue;
    if (Number(p.park_id) !== Number(rt.park_id)) { invalid.push(rt); continue; }
    valid.push(rt);
  }
  return { todo: valid.slice(0, limit), skipped: Math.max(0, valid.length - limit), invalid };
}

return {requestAttemptState, effectiveProcessedRequestIds, planQueue, planRetractions};
}
