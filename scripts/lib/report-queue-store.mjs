import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join, dirname, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const QUEUE_PATH = 'rapor/yayin-kuyrugu.json';
export const QUEUE_SCHEMA = 'dendrogeo-publish-queue/1';
export const QUEUE_CAP = 200;
const qpath = (rel) => (isAbsolute(String(rel)) ? String(rel) : join(ROOT, rel));
export function emptyQueue() {
  return { schema: QUEUE_SCHEMA, updated_at: null, entries: [] };
}
export function loadQueue(rel = QUEUE_PATH) {
  const p = qpath(rel);
  if (!existsSync(p)) return emptyQueue();
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    if (!j || j.schema !== QUEUE_SCHEMA || !Array.isArray(j.entries)) return emptyQueue();
    return j;
  } catch (e) { return emptyQueue(); }
}
export function saveQueue(q, rel = QUEUE_PATH) {
  const out = { ...q, ...(q.production_started_at ? {processed_request_ids:[...new Set([...(q.processed_request_ids||[]),...(q.entries||[]).filter(e=>e.request_id).map(e=>String(e.request_id))])],processed_retraction_ids:[...new Set([...(q.processed_retraction_ids||[]),...(q.entries||[]).filter(e=>e.retraction_id).map(e=>String(e.retraction_id))])]} : {}), schema: QUEUE_SCHEMA, updated_at: new Date().toISOString(), entries: (q.entries || []).slice(-QUEUE_CAP) };
  writeFileSync(qpath(rel), JSON.stringify(out, null, 2) + '\n');
  return out;
}

