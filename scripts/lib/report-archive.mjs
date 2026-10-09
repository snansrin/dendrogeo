import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT_DIR = join(ROOT, 'rapor');
export const DGR_ID_RE = /^DGR-\d{4}-\d{4}$/;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const formatTonnes = (kg) => Number(kg / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderIndex(list) {
  const rows = list.map((r) => `<tr><td><a href="${r.id}/">${r.id}</a></td><td class="tr">${escapeHtml(r.park)}</td><td>${r.n}</td><td>${r.carbon}</td><td>${r.date}</td><td><span class="badge on">Geçerli</span></td></tr>`).join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yayınlanmış Raporlar — DendroGeo</title>
<meta name="description" content="DendroGeo tarafından yayınlanmış, içerik hash'i ile dondurulmuş park ölçekli bilimsel raporların dizini.">
<link rel="canonical" href="https://dendrogeo.org/rapor/">
<link rel="stylesheet" href="../css/style.css"><link rel="stylesheet" href="../css/ui-standard.css">
</head><body class="dg-page"><header class="top"><div class="wrap nav"><a class="brand" href="../">🌲 DendroGeo</a><nav class="links"><a href="../">Uygulama</a><a href="../yontem/">Yöntem</a></nav></div></header>
<main><div class="wrap"><div class="hero"><div class="tag">BİLİMSEL RAPOR DİZİNİ</div><h1>Yayınlanmış Park Raporları</h1>
<p class="lead">Her rapor yayın anında dondurulur; kimlik (DGR — DendroGeo Bilimsel Analiz Raporu), sürüm ve SHA-256 içerik hash'i ile atanır. Bir raporun verisi değişmez; yeni çözümleme yeni rapor kimliği olarak yayınlanır.</p></div>
<table><thead><tr><th>Rapor</th><th>Park</th><th>n</th><th>Karbon (%95 GA)</th><th>Yayın</th><th>Durum</th></tr></thead><tbody>${rows || '<tr><td colspan=6>Henüz rapor yayınlanmadı.</td></tr>'}</tbody></table>
<p class="lead" style="margin-top:14px;font-size:.85rem">Geri çekilen raporlar bu listeden düşer; geri çekme kayıtları <a href="yayin-kuyrugu.json">yayın günlüğünde</a> gerekçesiyle saklanır ve DGR kimliği yeniden kullanılmaz.</p>
</div></main><footer><div class="wrap">DendroGeo · CC BY-NC 4.0</div></footer></body></html>`;
}

/* Filesystem adapter for the immutable report archive. */
export function rebuildIndex(dir = REPORT_DIR) {
  if (!existsSync(dir)) return [];
  const list = readdirSync(dir).filter((name) => DGR_ID_RE.test(name)).sort().map((name) => {
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
  writeFileSync(join(dir, 'index.html'), renderIndex(list));
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
