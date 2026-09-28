#!/usr/bin/env node
/* scripts/import-measurements.mjs — cihaz/saha çıktısını kanonik SQL'e çevirir.
 *
 * Neden var (2026-09-28 · Göksu Parkı envanteri, 0011):
 *   Elle panel girişi üç sistemik hata üretti: (1) cihazın "Çap" kolonu
 *   aslında ÇEVRE idi → DBH 9,05x şişti; (2) 11 kayıt sözlük dışı tür adıyla
 *   girdi → ρ grup varsayılanına düştü; (3) P7'de ondalık kayması (1962 →
 *   196,2). Bu araç aynı hataları İÇE AKTARIMDA yakalar: birim dönüşümü,
 *   kanonik tür çözümü, panel denklemiyle yeniden hesap ve QA kapıları.
 *
 * Kullanım:
 *   node scripts/import-measurements.mjs saha.csv --park 25 --project 26 [--owner UUID]
 *       [--birim cm|cevre|mm|auto] [--owner-email e@x] [--status Beklemede|Onaylı]
 *       [--out import.sql] [--json] [--dry-run] [--force]
 *
 * Girdi: CSV veya TSV; başlık satırı zorunlu. Kolon eşanlamlıları:
 *   nokta|point|point_id|no        → point_id       (zorunlu)
 *   tur|tür|species|agac|ağaç      → species        (zorunlu)
 *   grup|group|grp                 → grp            (zorunlu: İBRELİ/YAPRAKLI)
 *   cap|çap|dbh|dbm_cm|dbh_cm      → çap (cm)       (--birim cm|auto)
 *   cevre|çevre|girth|cevre_cm|girth_cm → çevre (cm) (--birim cevre|auto)
 *   boy|h|height|height_m|boy_m    → height_m       (zorunlu)
 *   karbon|carbon|carbon_kg|c_kg   → saklı karbon   (QA karşılaştırması)
 *   hacim|volume|vol|volume_m3     → saklı hacim    (QA karşılaştırması)
 *   foto|fotograf|fotoğraf|photo|photo_file|photo_url → fotoğraf
 *   lat|enlem|latitude … lon|boylam|longitude … acc|accuracy|accuracy_m …
 *   tarih|date|created_at|time|saat
 * Sayılar Türkçe biçimde olabilir (12,5 veya 1.234,56 → 1234.56).
 *
 * QA kapıları (mc.QA_LIMITS): boy/çap oranı, karbon yeniden hesabı, mükerrer
 * nokta, sözlük dışı tür, (park verilirse) konum çiti. Sistemik ihlal
 * (≥3 kayıt VE >%50) çıkışı 1 yapar ve SQL üretmez — --force ile aşılır
 * (üretilen SQL başına uyarı damgası basılır).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadRho, loadSpeciesDict, calcRow, QA_LIMITS } from './lib/mc.mjs';

const arg = (a) => { const i = process.argv.indexOf('--' + a); return i >= 0 ? process.argv[i + 1] : null; };
const has = (a) => process.argv.includes('--' + a);

/* ---- Türkçe-duyarlı sayı ayrıştırma: "1.234,56" ve "12.5" ikisi de olur ---- */
function parseNum(v) {
  if (v == null) return NaN;
  let t = String(v).trim().replace(/\s/g, '').replace(/[%°]/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');   // tr biçimi
  const x = Number(t);
  return Number.isFinite(x) ? x : NaN;
}
/* ---- basit CSV/TSV ayrıştırma (çift tırnak destekli) ---- */
function parseDelimited(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim().length) || '';
  const delim = (first.match(/\t/g) || []).length >= (first.match(/;/g) || []).length
    ? ((first.match(/\t/g) || []).length > 0 ? '\t' : ';')
    : ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',');
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
  return { rows, delim };
}
const COLMAP = [
  [['nokta', 'point', 'point_id', 'pointid', 'no', 'p'], 'point_id'],
  [['tur', 'species', 'agac', 'agac_adi', 'species_name'], 'species'],
  [['grup', 'group', 'grp'], 'grp'],
  [['cap', 'dbh', 'dbh_cm', 'cap_cm'], 'dbh_cm'],
  [['cevre', 'girth', 'cevre_cm', 'girth_cm', 'gogus_cevresi'], 'girth_cm'],
  [['boy', 'h', 'height', 'height_m', 'boy_m', 'uzunluk'], 'height_m'],
  [['karbon', 'carbon', 'carbon_kg', 'c_kg', 'karbon_kg'], 'carbon_kg'],
  [['hacim', 'volume', 'vol', 'volume_m3', 'hacim_m3'], 'volume_m3'],
  [['foto', 'fotograf', 'photo', 'photo_file', 'photo_url', 'resim'], 'photo'],
  [['lat', 'enlem', 'latitude', 'y'], 'lat'],
  [['lon', 'boylam', 'longitude', 'x'], 'lon'],
  [['acc', 'accuracy', 'accuracy_m', 'hassasiyet'], 'accuracy_m'],
  [['tarih', 'date', 'created_at', 'time', 'saat', 'timestamp'], 'date'],
  [['measurement_no', 'olcum_no', 'mno'], 'measurement_no'],
];
function mapHeader(cells, dict) {
  const idx = {};
  cells.forEach((c, i) => {
    const n = dict.norm(c).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const n2 = dict.norm(c).replace(/[^A-Z0-9]/g, '');
    for (const [keys, field] of COLMAP) {
      const k = keys.map((x) => dict.norm(x).replace(/[^A-Z0-9]/g, ''));
      if (k.includes(n2) || k.includes(n)) { if (!(field in idx)) idx[field] = i; break; }
    }
  });
  return idx;
}

/* ---- birim kararı ---- */
function decideUnit(records, birim) {
  if (birim && birim !== 'auto') return { unit: birim, why: '--birim ile verildi' };
  const hd = records.filter((r) => r.dbh_cm > 0 && r.height_m > 0).map((r) => (100 * r.height_m) / r.dbh_cm);
  if (!hd.length) return { unit: 'cm', why: 'oran hesabı için veri yok (varsayılan cm)' };
  hd.sort((a, b) => a - b);
  const med = hd[Math.floor(hd.length / 2)];
  if (med < QA_LIMITS.HD_MIN) return { unit: 'cevre', why: `medyan boy/çap ${med.toFixed(1)} < ${QA_LIMITS.HD_MIN} → kolon ÇEVRE gibi duruyor (DBH = çevre/π)` };
  if (med > QA_LIMITS.HD_MAX) return { unit: 'mm', why: `medyan boy/çap ${med.toFixed(1)} > ${QA_LIMITS.HD_MAX} → kolon mm gibi duruyor (÷10)` };
  return { unit: 'cm', why: `medyan boy/çap ${med.toFixed(1)} fiziksel aralıkta → kolon gerçek çap (cm)` };
}

/* ---- konum çiti (opsiyonel; ağ erişimi varsa) ---- */
async function parkFence(parkId) {
  try {
    const s = readFileSync(new URL('../src/config/supabase.js', import.meta.url), 'utf8');
    const url = s.match(/SB_URL="([^"]+)"/)[1], key = s.match(/SB_KEY="([^"]+)"/)[1];
    const r = await fetch(`${url}/rest/v1/parks?id=eq.${parkId}&select=id,name,geom_json,osm_key,area_m2`, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) return null;
    const p = (await r.json())[0];
    if (!p || !p.geom_json || !Array.isArray(p.geom_json.outer) || !p.geom_json.outer[0]) return null;
    const ring = p.geom_json.outer[0];
    /* bbox ise gerçek sınır sayma (rapor hattıyla aynı kural) */
    const lats = new Set(ring.map((q) => q[0])), lons = new Set(ring.map((q) => q[1]));
    if (ring.length >= 4 && lats.size === 2 && lons.size === 2) return null;
    const holes = p.geom_json.inner || [];
    const inRing = (lat, lon, rr) => { let ins = false; for (let i = 0, j = rr.length - 1; i < rr.length; j = i++) { const laI = rr[i][0], loI = rr[i][1], laJ = rr[j][0], loJ = rr[j][1]; if ((laI > lat) !== (laJ > lat) && lon < (loJ - loI) * (lat - laI) / (laJ - laI) + loI) ins = !ins; } return ins; };
    return {
      name: p.name,
      inside: (lat, lon) => { if (!inRing(lat, lon, ring)) return false; for (const h of holes) if (inRing(lat, lon, h)) return false; return true; },
    };
  } catch (e) { return null; }
}

/* ============================== ANA AKIŞ ============================== */
const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
if (!file || has('help')) {
  console.log(`Kullanım: node scripts/import-measurements.mjs <saha.csv|saha.tsv> --park N --project N [seçenekler]
  --birim cm|cevre|mm|auto   çap kolonunun birimi (varsayılan auto: medyan boy/çap oranına bakar)
  --owner UUID               measurements.owner (RLS: kayıt sahibi)
  --owner-email e@x          --owner verilmediyse profiles'dan UUID çözülür (anon okuma)
  --status Beklemede|Onaylı  durum (varsayılan Beklemede — moderasyon panelden)
  --city/--country           künye alanları (ops.)
  --out dosya.sql            SQL çıktısı (varsayılan: import-<park>-<ts>.sql)
  --dry-run                  yalnız QA raporu; SQL yazmaz
  --json                     QA raporunu makine okur bas
  --force                    blok kapısına rağmen SQL üret (başına uyarı damgası)`);
  process.exit(file ? 0 : 2);
}
const dict = loadSpeciesDict();
/* ρ önceliği (0011b): kanonik ad sözlükte ρ taşıyorsa (gizli çözüm kayıtları
 * dahil) o kullanılır — 0011'in çalıştırılmış SQL'i ve rapor QA kapısıyla
 * AYNI tablo. Panel (calc) kendi zincirini kullanmaya devam eder. */
const _base = loadRho();
const rho = Object.assign({}, _base.rho);
for (const e of Object.values(dict.byName)) if (e.rho) rho[e.tr] = e.rho;
const grho = _base.grho;
const text = readFileSync(file, 'utf8');
const { rows, delim } = parseDelimited(text);
if (rows.length < 2) { console.error('❌ en az başlık + 1 veri satırı gerekli'); process.exit(2); }
const idx = mapHeader(rows[0], dict);
for (const f of ['point_id', 'species', 'grp', 'height_m'])
  if (idx[f] == null) { console.error(`❌ zorunlu kolon bulunamadı: ${f} (başlık: ${rows[0].join(' | ')})`); process.exit(2); }
if (idx.dbh_cm == null && idx.girth_cm == null) { console.error('❌ çap veya çevre kolonu yok'); process.exit(2); }

const warn = [], errs = [];
const recs = [];
for (let li = 1; li < rows.length; li++) {
  const c = rows[li];
  const g = (f) => (idx[f] != null ? c[idx[f]] : undefined);
  const point = parseNum(String(g('point_id') || '').replace(/^[PpNn°#.\s]+/, ''));
  const spRaw = String(g('species') || '').trim();
  const grpRaw = String(g('grp') || '').trim();
  if (!Number.isFinite(point)) { errs.push(`satır ${li + 1}: nokta no ayrıştırılamadı (${g('point_id')})`); continue; }
  const GRP = dict.norm(grpRaw).replace(/[^A-Z]/g, '');
  const grp = GRP.startsWith('IBRE') || GRP.startsWith('İBRE') ? 'İBRELİ' : GRP.startsWith('YAPRAK') ? 'YAPRAKLI' : (grpRaw || null);
  if (!['İBRELİ', 'YAPRAKLI', 'DİĞER'].includes(grp)) warn.push(`P${point}: grup tanınmadı (${grpRaw}) → DİĞER varsayılanı`);
  const canon = dict.resolve(spRaw);
  if (!canon) warn.push(`P${point}: tür sözlük dışında (${spRaw}) → ρ grup varsayılanı`);
  recs.push({
    line: li + 1, point_id: Math.round(point), measurement_no: Math.round(parseNum(g('measurement_no')) || 1),
    species_raw: spRaw, species: canon || spRaw, grp: grp || 'DİĞER',
    dbh_cm: idx.girth_cm != null && idx.dbh_cm == null ? NaN : parseNum(g('dbh_cm')),
    girth_cm: parseNum(g('girth_cm')),
    height_m: parseNum(g('height_m')),
    carbon_stored: parseNum(g('carbon_kg')), volume_stored: parseNum(g('volume_m3')),
    photo: g('photo') || null, lat: parseNum(g('lat')), lon: parseNum(g('lon')),
    accuracy_m: parseNum(g('accuracy_m')), date: g('date') || null,
  });
}
if (!recs.length) { console.error('❌ ayrıştırılabilir kayıt yok'); errs.forEach((e) => console.error('  ' + e)); process.exit(2); }

/* ---- birim kararı + dönüşüm (ham değer ASLA kaybolmaz: girth_cm saklanır) ---- */
const birimArg = (arg('birim') || 'auto').toLowerCase();
const forAuto = recs.map((r) => ({ dbh_cm: Number.isFinite(r.dbh_cm) ? r.dbh_cm : r.girth_cm, height_m: r.height_m }));
const decided = decideUnit(forAuto, birimArg === 'auto' ? null : birimArg);
for (const r of recs) {
  const raw = Number.isFinite(r.dbh_cm) ? r.dbh_cm : r.girth_cm;
  if (!Number.isFinite(raw) || raw <= 0) { errs.push(`P${r.point_id}: çap/çevre yok veya ≤ 0`); r.skip = true; continue; }
  if (!Number.isFinite(r.height_m) || r.height_m <= 0) { errs.push(`P${r.point_id}: boy yok veya ≤ 0`); r.skip = true; continue; }
  r.raw_col = raw;
  if (decided.unit === 'cevre') { r.girth_cm = raw; r.dbh_cm = +(raw / Math.PI).toFixed(2); }
  else if (decided.unit === 'mm') { r.girth_cm = null; r.dbh_cm = +(raw / 10).toFixed(2); }
  else { r.girth_cm = Number.isFinite(r.girth_cm) ? r.girth_cm : null; r.dbh_cm = +raw.toFixed(2); }
}
const live = recs.filter((r) => !r.skip);

/* ---- QA: yeniden hesap + kapılar ---- */
const hdFail = [], devFail = [], dupPts = [], dupVals = [], outside = [];
for (const r of live) {
  const calc = calcRow(r.dbh_cm, r.height_m, r.species, r.grp, { rho, grho });
  r.carbon_calc = +calc.total_carbon.toFixed(2);
  r.volume_calc = +calc.vol.toFixed(3);
  r.hd = +((100 * r.height_m) / r.dbh_cm).toFixed(1);
  if (r.hd < QA_LIMITS.HD_MIN || r.hd > QA_LIMITS.HD_MAX) { hdFail.push(r); warn.push(`P${r.point_id}: boy/çap ${r.hd} fiziksel aralık dışında (${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX}) — tekil bodur ağaçsa sorun değil, sistemikse kapı bloklar`); }
  if (Number.isFinite(r.carbon_stored) && r.carbon_stored > 0) {
    r.dev_pct = +(((r.carbon_stored - r.carbon_calc) / r.carbon_calc) * 100).toFixed(1);
    if (Math.abs(r.dev_pct) > QA_LIMITS.CARBON_DEV_PCT && Math.abs(r.carbon_stored - r.carbon_calc) >= (QA_LIMITS.CARBON_DEV_MIN_KG ?? 0)) { devFail.push(r); warn.push(`P${r.point_id}: saklı karbon ${r.carbon_stored} kg ≠ yeniden hesap ${r.carbon_calc} kg (%${r.dev_pct}) — ondalık kayması/birim hatası olabilir`); }
  }
}
const seen = new Map();
for (const r of live) {
  const k = r.point_id;
  if (seen.has(k)) { dupPts.push(r); errs.push(`P${r.point_id}: mükerrer nokta no (satır ${seen.get(k)} ve ${r.line})`); }
  else seen.set(k, r.line);
  const v = live.filter((q) => q !== r && Math.abs(q.dbh_cm - r.dbh_cm) < 1e-9 && Math.abs(q.height_m - r.height_m) < 1e-9 && Math.abs(q.carbon_calc - r.carbon_calc) < 1e-6 && Math.abs(q.lat - r.lat) < 1e-6 && Math.abs(q.lon - r.lon) < 1e-6);
  if (v.length && r.point_id < v[0].point_id) dupVals.push([r, v[0]]);
}
for (const [a, b] of dupVals) warn.push(`P${a.point_id} ≡ P${b.point_id}: çap+boy+konum birebir aynı — mükerrer ölçüm şüphesi, sahada doğrulayın`);

const N = live.length || 1;
const gates = {
  unit: { ok: decided.unit !== 'cm' || !hdFail.length, note: `${decided.unit} (${decided.why})` },
  hd: { fail: hdFail.length, block: hdFail.length >= QA_LIMITS.BLOCK_MIN_N && hdFail.length / N > QA_LIMITS.BLOCK_RATIO },
  dev: { fail: devFail.length, block: devFail.length >= QA_LIMITS.BLOCK_MIN_N && devFail.length / N > QA_LIMITS.BLOCK_RATIO },
  unknown_species: recs.filter((r) => !r.species || !dict.byName[r.species]).length,
  dup_points: dupPts.length, hard_errors: errs.length,
};

/* ---- konum çiti ---- */
let fence = null;
const parkId = arg('park');
if (parkId && live.some((r) => Number.isFinite(r.lat))) {
  fence = await parkFence(parkId);
  if (fence) for (const r of live) if (Number.isFinite(r.lat) && Number.isFinite(r.lon) && !fence.inside(r.lat, r.lon)) { outside.push(r); warn.push(`P${r.point_id}: konum park poligonu DIŞINDA (${r.lat}, ${r.lon}) — trg_geo_fence INSERT'i reddeder`); }
}
gates.geofence = fence ? { checked: live.filter((r) => Number.isFinite(r.lat)).length, outside: outside.length, block: outside.length > 0 } : null;

/* ---- sahip çözümü ---- */
let owner = arg('owner');
if (!owner && arg('owner-email')) {
  try {
    const s = readFileSync(new URL('../src/config/supabase.js', import.meta.url), 'utf8');
    const url = s.match(/SB_URL="([^"]+)"/)[1], key = s.match(/SB_KEY="([^"]+)"/)[1];
    const r = await fetch(`${url}/rest/v1/profiles?email=eq.${encodeURIComponent(arg('owner-email'))}&select=id,full_name`, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    const j = await r.json();
    if (j && j[0]) owner = j[0].id;
  } catch (e) { /* çözülmedi */ }
}

/* ---- SQL üretimi ---- */
const blocked = gates.hd.block || gates.dev.block || errs.length > 0 || (gates.geofence && gates.geofence.block);
const force = has('force');
const projectId = arg('project');
const status = arg('status') || 'Beklemede';
if (!['Beklemede', 'Onaylı'].includes(status)) { console.error('❌ --status yalnız Beklemede|Onaylı'); process.exit(2); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outPath = arg('out') || `import-${parkId || 'x'}-${ts}.sql`;

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const sqlHead = [
  `-- DendroGeo içe aktarma · ${new Date().toISOString()}`,
  `-- kaynak: ${file} · birim kararı: ${decided.unit} (${decided.why})`,
  `-- QA: ${live.length} kayıt · h/d ihlal ${gates.hd.fail} · karbon sapma ${gates.dev.fail} · sözlük dışı ${gates.unknown_species} · mükerrer nokta ${gates.dup_points}`,
  force && blocked ? '-- ⚠ --force ile üretildi: QA kapısı BLOK durumundaydı; çalıştırmadan önce nedenleri gözden geçirin!' : null,
  `-- İdempotent: client_id UNIQUE anahtarı 'dgi:<park>:<nokta>:<ölçüno>' → aynı dosya ikinci kez çalıştırılamaz.`,
  'begin;',
].filter(Boolean).join('\n');
const sqlBody = live.map((r) => {
  const cid = `dgi:${parkId || 0}:${r.point_id}:${r.measurement_no}`;
  return `insert into public.measurements
  (client_id, owner, project_id, park_id, point_id, measurement_no, lat, lon, accuracy_m,
   country, city, grp, species, dbh_cm, girth_cm, height_m, volume_m3, carbon_kg,
   photo_file, photo_url, status, created_at)
values
  (${q(cid)}, ${owner ? q(owner) : 'null'}, ${projectId || 'null'}, ${parkId || 'null'}, ${r.point_id}, ${r.measurement_no},
   ${Number.isFinite(r.lat) ? r.lat : 'null'}, ${Number.isFinite(r.lon) ? r.lon : 'null'}, ${Number.isFinite(r.accuracy_m) ? r.accuracy_m : 'null'},
   ${q(arg('country'))}, ${q(arg('city'))}, ${q(r.grp)}, ${q(r.species)}, ${r.dbh_cm}, ${Number.isFinite(r.girth_cm) ? r.girth_cm : 'null'}, ${r.height_m},
   ${r.volume_calc}, ${r.carbon_calc},
   ${r.photo ? q(String(r.photo)) : 'null'}, ${r.photo && /^https?:\/\//.test(String(r.photo)) ? q(String(r.photo)) : 'null'}, ${q(status)},
   ${r.date ? q(r.date) : 'now()'})
on conflict (client_id) do nothing;`;
}).join('\n\n');
const totStored = live.reduce((a, r) => a + (Number.isFinite(r.carbon_stored) ? r.carbon_stored : 0), 0);
const totCalc = live.reduce((a, r) => a + r.carbon_calc, 0);
const sqlFoot = [
  '',
  `-- beklenen toplam karbon: ${(totCalc / 1000).toFixed(3)} t (saklı değerler toplamı ${(totStored / 1000).toFixed(3)} t idi)`,
  'commit;',
  `-- doğrulama: select count(*), round(sum(carbon_kg)/1000,3) as t from public.measurements where park_id = ${parkId || 'NULL'} and status = 'Onaylı';`,
].join('\n');
const sql = [sqlHead, sqlBody, sqlFoot].join('\n') + '\n';

/* ---- rapor ---- */
const summary = {
  file, delim, rows: recs.length, live: live.length, skipped: recs.length - live.length,
  unit: decided, gates, blocked: !!blocked, forced: !!force,
  totals: { stored_t: +(totStored / 1000).toFixed(3), calc_t: +(totCalc / 1000).toFixed(3), ratio: totStored > 0 ? +(totStored / totCalc).toFixed(2) : null },
  records: live.map((r) => ({ point_id: r.point_id, species: r.species, grp: r.grp, girth_cm: Number.isFinite(r.girth_cm) ? r.girth_cm : null, dbh_cm: r.dbh_cm, height_m: r.height_m, hd: r.hd, carbon_stored: Number.isFinite(r.carbon_stored) ? r.carbon_stored : null, carbon_calc: r.carbon_calc, dev_pct: Number.isFinite(r.dev_pct) ? r.dev_pct : null, lat: Number.isFinite(r.lat) ? r.lat : null, lon: Number.isFinite(r.lon) ? r.lon : null })),
  warn: warn.slice(0, 40), errors: errs,
  out: has('dry-run') ? null : outPath,
};
if (has('json')) console.log(JSON.stringify(summary, null, 1));
else {
  console.log(`📥 ${file}: ${recs.length} satır → ${live.length} geçerli kayıt (${delim === '\t' ? 'TSV' : 'CSV:' + delim})`);
  console.log(`📏 birim: ${decided.unit.toUpperCase()} — ${decided.why}`);
  console.log(`🧮 toplam karbon: saklı ${(totStored / 1000).toFixed(2)} t → yeniden hesap ${(totCalc / 1000).toFixed(2)} t${totStored > 0 ? ` (oran ${(totStored / totCalc).toFixed(2)}x)` : ''}`);
  console.log(`🚦 kapılar: h/d ${gates.hd.fail}/${live.length}${gates.hd.block ? ' ⛔BLOK' : ''} · karbon ${gates.dev.fail}/${live.length}${gates.dev.block ? ' ⛔BLOK' : ''} · sözlük dışı ${gates.unknown_species} · mükerrer ${gates.dup_points} · hata ${errs.length}${gates.geofence ? ` · çit dışı ${gates.geofence.outside}/${gates.geofence.checked}` : ''}`);
  for (const w of warn.slice(0, 15)) console.log('   ⚠ ' + w);
  if (warn.length > 15) console.log(`   … +${warn.length - 15} uyarı daha`);
  for (const e of errs.slice(0, 10)) console.log('   ❌ ' + e);
  if (blocked && !force) { console.log('⛔ QA kapısı BLOK: SQL üretilmedi. Nedenleri giderin veya bilinçli olarak --force kullanın.'); process.exit(1); }
  if (!has('dry-run')) { writeFileSync(outPath, sql); console.log(`✅ SQL yazıldı: ${outPath} — Supabase SQL Editor'da çalıştırın (idempotent).`); }
  else console.log('🧪 dry-run: SQL yazılmadı.');
}
