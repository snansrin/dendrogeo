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
  // The queue file is committed to a public repository and served by Pages.
  // Keep only operational/report fields; never publish account IDs, free-text
  // withdrawal reasons, or the timestamp at which an individual requested it.
  const validEntries = Array.isArray(q.entries);
  const sourceEntries = validEntries ? q.entries : [];
  const entries = validEntries ? sourceEntries.slice(-QUEUE_CAP).map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !entry.retraction_id) return entry;
    const {requested_by, requested_at, reason, ...publicEntry} = entry;
    return publicEntry;
  }) : q.entries;
  const out = { ...q, ...(q.production_started_at ? {processed_request_ids:[...new Set([...(q.processed_request_ids||[]),...sourceEntries.filter(e=>e.request_id).map(e=>String(e.request_id))])],processed_retraction_ids:[...new Set([...(q.processed_retraction_ids||[]),...sourceEntries.filter(e=>e.retraction_id).map(e=>String(e.retraction_id))])]} : {}), schema: QUEUE_SCHEMA, updated_at: new Date().toISOString(), entries };
  writeFileSync(qpath(rel), JSON.stringify(out, null, 2) + '\n');
  return out;
}
