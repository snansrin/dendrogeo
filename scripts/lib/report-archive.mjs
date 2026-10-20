import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {syncReportSitemap} from './report-sitemap.mjs';
import {publicPageThemeHead} from './public-page-theme.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT_DIR = join(ROOT, 'rapor');
export const DGR_ID_RE = /^DGR-\d{4}-\d{4}$/;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const formatTonnes = (kg) => Number(kg / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderIndex(list, retractedReports) {
  const rows = list.map((r) => `<tr><td><a href="gorunum/?id=${r.id}&amp;v=3">${r.id}</a></td><td class="tr">${escapeHtml(r.park)}</td><td>${r.n}</td><td>${r.carbon}</td><td>${r.date}</td><td><span class="badge on">Geçerli</span></td></tr>`).join('');
  const retractedRows = retractedReports.map((r) => {
    const doi = r.doi
      ? `<a href="https://doi.org/${r.doi}" rel="noopener noreferrer">${escapeHtml(r.doi)}</a>`
      : 'DOI kaydı yok';
    return `<tr><td><a href="${r.id}/">${r.id}</a></td><td>${doi}</td><td>${r.date || '—'}</td><td><span class="badge admin">Geri çekildi</span></td></tr>`;
  }).join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yayınlanmış Raporlar — DendroGeo</title>
<meta name="description" content="DendroGeo tarafından yayınlanmış, içerik hash'i ile dondurulmuş park ölçekli bilimsel raporların dizini.">
<link rel="canonical" href="https://dendrogeo.org/rapor/">
${publicPageThemeHead('..')}
</head><body class="dg-page"><header class="top"><div class="wrap nav"><a class="brand" href="../">🌲 DendroGeo</a><nav class="links"><a href="../">Uygulama</a><a href="../yontem/">Yöntem</a></nav></div></header>
<main><div class="wrap"><div class="hero"><div class="tag">BİLİMSEL RAPOR DİZİNİ</div><h1>Yayınlanmış Park Raporları</h1>
<p class="lead">Her rapor yayın anında dondurulur; kimlik (DGR — DendroGeo Bilimsel Analiz Raporu), sürüm ve SHA-256 içerik hash'i ile atanır. Bir raporun verisi değişmez; yeni çözümleme yeni rapor kimliği olarak yayınlanır.</p></div>
<h2>Geçerli yayınlar</h2><table><thead><tr><th>Rapor</th><th>Park</th><th>n</th><th>Karbon (%95 GA)</th><th>Yayın</th><th>Durum</th></tr></thead><tbody>${rows || '<tr><td colspan=6>Henüz geçerli rapor yayınlanmadı.</td></tr>'}</tbody></table>
<h2>Yayından geri çekilen raporlar</h2><table><thead><tr><th>DGR kimliği</th><th>DOI</th><th>Geri çekilme tarihi</th><th>Durum</th></tr></thead><tbody>${retractedRows || '<tr><td colspan=4>Geri çekilmiş rapor yok.</td></tr>'}</tbody></table>
<p class="lead" style="margin-top:14px;font-size:.85rem">Geri çekilen raporların veri dosyaları yayından kaldırılır; DGR kimlikleri kalıcıdır ve yeniden kullanılmaz.</p>
</div></main><footer><div class="wrap">DendroGeo · CC BY-NC 4.0</div></footer></body></html>`;
}

/* Filesystem adapter for the immutable report archive. */
export function readReportIndex(dir = REPORT_DIR) {
  if (!existsSync(dir)) return [];
  const queue = readPublishQueue(dir);
  const retracted = new Set((queue?.entries || []).filter((entry) => entry.status === 'Geri çekildi').map((entry) => String(entry.report_id)));
  const retired = new Set((queue?.retired_report_ids || []).map(String));
  const list = readdirSync(dir).filter((name) => DGR_ID_RE.test(name)).sort().map((name) => {
    if (retracted.has(name) || retired.has(name)) return null;
    try {
      const snapshot = JSON.parse(readFileSync(join(dir, name, 'data.json'), 'utf8'));
      return {
        id: name,
        park: snapshot.park.name,
        n: snapshot.totals.n,
        carbon: `${formatTonnes(snapshot.totals.ci.mean)} t [${formatTonnes(snapshot.totals.ci.lo)}–${formatTonnes(snapshot.totals.ci.hi)}]`,
        date: snapshot.generated_at.slice(0, 10),
      };
    } catch (error) { return null; }
  }).filter(Boolean);
  return list;
}

function readPublishQueue(dir = REPORT_DIR) {
  try { return JSON.parse(readFileSync(join(dir, 'yayin-kuyrugu.json'), 'utf8')); }
  catch { return null; }
}

export function readRetractedReportIndex(dir = REPORT_DIR) {
  const queue = readPublishQueue(dir);
  const entries = Array.isArray(queue?.entries) ? queue.entries : [];
  const publications = new Map();
  for (const entry of entries) {
    if (entry.status === 'Yayınlandı' && DGR_ID_RE.test(String(entry.report_id || ''))) publications.set(String(entry.report_id), entry);
  }
  const retractions = new Map();
  for (const entry of entries) {
    const id = String(entry.report_id || '');
    if (entry.status !== 'Geri çekildi' || !DGR_ID_RE.test(id)) continue;
    const publication = publications.get(id) || {};
    const rawDate = entry.finished_at || entry.completed_at || entry.started_at || '';
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : '';
    const rawDoi = String(publication.doi || entry.doi || '');
    const doi = /^10\.5281\/zenodo\.\d+$/.test(rawDoi) ? rawDoi : '';
    retractions.set(id, { id, doi, date });
  }
  return [...retractions.values()].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function rebuildIndex(dir = REPORT_DIR) {
  if(!existsSync(dir))return [];
  const list=readReportIndex(dir);
  writeFileSync(join(dir,'index.html'),renderIndex(list,readRetractedReportIndex(dir)));
  syncReportSitemap(join(dirname(dir),'sitemap.xml'),list,{write:true});
  return list;
}

/* Sıradaki DGR: yıl içindeki en yüksek kayıt numarasının bir sonrası. */
export function nextReportId(dir, year) {
  const existing = existsSync(dir) ? readdirSync(dir).filter((name) => name.startsWith('DGR-' + year + '-')).sort() : [];
  const highest = existing.reduce((value, name) => Math.max(value, Number(name.split('-')[2]) || 0), 0);
  return `DGR-${year}-${String(highest + 1).padStart(4, '0')}`;
}

/* Aynı parkın önceki yayınlarını günlükten kurar; test ve geri çekme kayıtları yok sayılır. */
export function parkHistory(dir, parkId, selfId) {
  try {
    const queue = JSON.parse(readFileSync(join(dir, 'yayin-kuyrugu.json'), 'utf8'));
    const entries = Array.isArray(queue.entries) ? queue.entries : [];
    const retired = new Set(queue.retired_report_ids || []);
    const retracted = new Set(entries.filter((entry) => entry.status === 'Geri çekildi').map((entry) => String(entry.report_id)));
    return entries.filter((entry) => !retired.has(entry.report_id) && entry.status === 'Yayınlandı' && Number(entry.park_id) === Number(parkId) && String(entry.report_id) !== String(selfId))
      .map((entry) => ({
        id: String(entry.report_id),
        date: String(entry.finished_at || '').slice(0, 10),
        retracted: retracted.has(String(entry.report_id)),
        note: retracted.has(String(entry.report_id)) ? 'Aynı parkın önceki analizi (geri çekildi)' : 'Aynı parkın önceki analizi (bu raporla yenilendi)',
      }));
  } catch (error) { return []; }
}
