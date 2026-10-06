#!/usr/bin/env node
/* scripts/import-measurements.mjs — cihaz/saha çıktısını kanonik SQL'e çevirir.
 *
 * Neden var (2026-09-28 · Göksu Parkı envanteri, 0011):
 *   Elle panel girişi sistemik hatalar üretti: sözlük dışı tür adları (ρ grup
 *   varsayılanına düştü), ondalık kaymaları, mükerrer noktalar. Bu araç aynı
 *   hataları İÇE AKTARIMDA yakalar: kanonik tür çözümü, panel denklemiyle
 *   yeniden hesap ve QA kapıları.
 *
 * 0031 DÜZELTMESİ (kullanıcı kararı, 2026-09-29): DBH = GÖĞÜS ÇAPI'dır,
 *   birimi cm'dir, sahada doğrudan çap olarak kaydedilir. Bu araç
 *   çevre→çap (÷π) dönüşümü YAPMAZ; `--birim cevre` seçeneği kaldırıldı.
 *   `girth_cm` kolonu yalnız HAM DENETİM alanı olarak saklanır ve DBH
 *   türetmek için KULLANILMAZ. Boy/çap oranı bir İNCELEME göstergesidir:
 *   uyarı basar, içe aktarmayı BLOKLAMAZ.
 *
 * Kullanım:
 *   node scripts/import-measurements.mjs saha.csv --park 25 --project 26 [--owner UUID]
 *       [--birim cm|mm|auto] [--owner-email e@x] [--status Beklemede|Onaylı]
 *       [--out import.sql] [--json] [--dry-run] [--force]
 *
 * Girdi: CSV veya TSV; başlık satırı zorunlu. Kolon eşanlamlıları:
 *   nokta|point|point_id|no        → point_id       (zorunlu)
 *   tur|tür|species|agac|ağaç      → species        (zorunlu)
 *   grup|group|grp                 → grp            (zorunlu: İBRELİ/YAPRAKLI)
 *   cap|çap|dbh|dbm_cm|dbh_cm      → göğüs çapı (cm) — ZORUNLU (--birim cm|auto)
 *   cevre|çevre|girth|cevre_cm|girth_cm → ham çevre (cm): yalnız denetim
 *       alanı olarak saklanır; DBH bu kolondan TÜRETİLMEZ (0031)
 *   boy|h|height|height_m|boy_m    → height_m       (zorunlu)
 *   karbon|carbon|carbon_kg|c_kg   → saklı karbon   (QA karşılaştırması)
 *   hacim|volume|vol|volume_m3     → saklı hacim    (QA karşılaştırması)
 *   foto|fotograf|fotoğraf|photo|photo_file|photo_url → fotoğraf
 *   lat|enlem|latitude … lon|boylam|longitude … acc|accuracy|accuracy_m …
 *   tarih|date|created_at|time|saat
 * Sayılar Türkçe biçimde olabilir (12,5 veya 1.234,56 → 1234.56).
 *
 * QA kapıları (mc.QA_LIMITS): DBH geçerliliği (var/sayısal/pozitif/cm
 * aralığı), karbon yeniden hesabı, mükerrer nokta, sözlük dışı tür, (park
 * verilirse) konum çiti. Sistemik ihlal (≥3 kayıt VE >%50) çıkışı 1 yapar ve
 * SQL üretmez — --force ile aşılır (üretilen SQL başına uyarı damgası
 * basılır). Boy/çap oranı 0031'den beri YALNIZ uyarıdır, blok değildir.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadRho, loadSpeciesDict, calcRow, medianOf, QA_LIMITS } from './lib/mc.mjs';

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

/* ---- birim kararı (0031: DBH = göğüs çapı, cm) ----
 * Eski sürüm medyan boy/çap oranına bakarak kolonu "çevre" ilan edip
 * dbh_cm = çevre/π dönüşümü uyguluyordu. Bu varsayım yanlıştı: saha verisi
 * göğüs çapıdır ve olduğu gibi kaydedilir. Artık:
 *   auto → cm (dönüşüm YOK), oran yalnız inceleme uyarısı üretir
 *   --birim cm|mm → operatörün açık beyanı (mm: ÷10, birim düzeltmesi)
 *   --birim cevre → REDDEDİLİR (exit 2): DendroGeo çevre→çap dönüşümü yapmaz */
function decideUnit(records, birim) {
  if (birim === 'cevre' || birim === 'çevre' || birim === 'girth') {
    console.error('❌ --birim cevre KALDIRILDI (0031): DendroGeo çevre→çap (÷π) dönüşümü YAPMAZ.');
    console.error('   DBH = göğüs çapı (cm) ve sahada doğrudan çap olarak kaydedilir.');
    console.error('   Kaynak dosyanızda gerçekten ÇEVRE taşıyan bir kolon varsa, dosyayı');
    console.error('   göğüs çapı (cm) kolonuyla yeniden düzenleyin; dönüşümü DendroGeo yapmaz.');
    process.exit(2);
  }
  if (birim === 'mm') return { unit: 'mm', why: '--birim mm ile verildi (cm = mm/10; birim düzeltmesi, çevre→çap dönüşümü DEĞİL)' };
  if (birim && birim !== 'auto') return { unit: 'cm', why: '--birim ile verildi' };
  const hd = records.filter((r) => r.dbh_cm > 0 && r.height_m > 0).map((r) => (100 * r.height_m) / r.dbh_cm);
  if (!hd.length) return { unit: 'cm', why: 'DBH = göğüs çapı (cm) kabul edildi; oran hesabı için veri yok' };
  hd.sort((a, b) => a - b);
  const med = hd[Math.floor(hd.length / 2)];
  /* 0032 · medyan oran YALNIZ bilgidir: birim kararı DBH = göğüs çapı (cm)
   * olarak SABİTTİR (0031). Fiziksel makullük bandı dışı medyan → İNCELEME
   * notu; tipik 15–120 bandı dışı medyan → geniş gövdeli/bodur form olağandır. */
  if (med < QA_LIMITS.HD_PHYS_MIN || med > QA_LIMITS.HD_PHYS_MAX) {
    return { unit: 'cm', why: `DBH = göğüs çapı (cm) kabul edildi, dönüşüm uygulanmadı · medyan boy/çap ${med.toFixed(1)} fiziksel makullük bandı (${QA_LIMITS.HD_PHYS_MIN}–${QA_LIMITS.HD_PHYS_MAX}) dışında → İNCELEME uyarısı (blok değil)` };
  }
  if (med < QA_LIMITS.HD_MIN || med > QA_LIMITS.HD_MAX) {
    return { unit: 'cm', why: `DBH = göğüs çapı (cm) kabul edildi, dönüşüm uygulanmadı · medyan boy/çap ${med.toFixed(1)} tipik ${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX} bandı dışında → BİLGİ (geniş gövdeli/bodur form olağandır; uyarı değil, blok hiç değil)` };
  }
  return { unit: 'cm', why: `DBH = göğüs çapı (cm) · medyan boy/çap ${med.toFixed(1)} tipik gösterge aralığında` };
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
  --birim cm|mm|auto         göğüs çapı kolonunun birimi (varsayılan auto = cm)
                             NOT: 'cevre' KALDIRILDI (0031) — çevre→çap (÷π)
                             dönüşümü yapılmaz; DBH sahada çap olarak ölçülür
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
if (idx.dbh_cm == null && idx.girth_cm == null) { console.error('❌ göğüs çapı (dbh/cap/çap) kolonu yok'); process.exit(2); }
/* 0031: çevre kolonundan DBH TÜRETİLMEZ. Dosyada yalnız çevre kolonu varsa
 * içe aktarma durdurulur — sessiz ÷π dönüşümü yapılmaz. */
if (idx.dbh_cm == null) {
  console.error('❌ göğüs çapı (cm) kolonu bulunamadı; yalnız çevre kolonu var.');
  console.error('   0031: çevre→çap (÷π) dönüşümü YAPILMAZ. DBH, sahada ölçülen göğüs');
  console.error('   çapıdır (cm) ve dosyada cap|çap|dbh|dbh_cm başlıklı bir kolon olmalıdır.');
  process.exit(2);
}

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
    dbh_cm: parseNum(g('dbh_cm')),
    girth_cm: parseNum(g('girth_cm')),
    height_m: parseNum(g('height_m')),
    carbon_stored: parseNum(g('carbon_kg')), volume_stored: parseNum(g('volume_m3')),
    photo: g('photo') || null, lat: parseNum(g('lat')), lon: parseNum(g('lon')),
    accuracy_m: parseNum(g('accuracy_m')), date: g('date') || null,
  });
}
if (!recs.length) { console.error('❌ ayrıştırılabilir kayıt yok'); errs.forEach((e) => console.error('  ' + e)); process.exit(2); }

/* ---- birim kararı (0031: çevre→çap dönüşümü YOK; ham girth_cm yalnız denetim) ---- */
const birimArg = (arg('birim') || 'auto').toLowerCase();
const decided = decideUnit(recs, birimArg === 'auto' ? null : birimArg);
if (idx.girth_cm != null) warn.push('Dosyada çevre (girth) kolonu var: HAM denetim değeri olarak girth_cm\'e yazılır; DBH bu kolondan TÜRETİLMEZ (0031).');
for (const r of recs) {
  const raw = r.dbh_cm;
  if (!Number.isFinite(raw) || raw <= 0) { errs.push(`P${r.point_id}: göğüs çapı (DBH) yok veya ≤ 0`); r.skip = true; continue; }
  if (!Number.isFinite(r.height_m) || r.height_m <= 0) { errs.push(`P${r.point_id}: boy yok veya ≤ 0`); r.skip = true; continue; }
  r.raw_col = raw;
  /* mm → cm birim düzeltmesi (operatörün açık beyanı). π ile HİÇBİR yol yok. */
  if (decided.unit === 'mm') { r.dbh_cm = +(raw / 10).toFixed(2); }
  else { r.dbh_cm = +raw.toFixed(2); }
  r.girth_cm = Number.isFinite(r.girth_cm) ? r.girth_cm : null;
}
const live = recs.filter((r) => !r.skip);

/* ---- QA: yeniden hesap + kapılar ---- */
/* 0033 · QA v5 ile aynı kurallar: (b) gövde formu fiziksel bant + tipik bant
 * SAYIMI, (c) karbon denetimi İKİ ρ kaynağıyla (tür ρ / grup varsayılanı ρ).
 * 0032deki eşik tabanlı gövde sınıfı sayımı KALDIRILDI: içe aktarma hiçbir
 * yasal statü iddiası üretmez, yalnız ölçülen çap dağılımını özetler. */
const hdFail = [], hdBandOut = [], devFail = [], devRhoGrup = [], dupPts = [], dupVals = [], outside = [];
const BAND = QA_LIMITS.CARBON_DEV_PCT, TABAN = QA_LIMITS.CARBON_DEV_MIN_KG ?? 0;
const uygun = (sakli, beklenen) => beklenen > 0 && (Math.abs(((sakli - beklenen) / beklenen) * 100) <= BAND || Math.abs(sakli - beklenen) < TABAN);
for (const r of live) {
  const calc = calcRow(r.dbh_cm, r.height_m, r.species, r.grp, { rho, grho });
  const calcGrup = calcRow(r.dbh_cm, r.height_m, r.species, r.grp, { rho: {}, grho });
  r.carbon_calc = +calc.total_carbon.toFixed(2);
  r.volume_calc = +calc.vol.toFixed(3);
  r.hd = +((100 * r.height_m) / r.dbh_cm).toFixed(1);
  if (r.hd < QA_LIMITS.HD_PHYS_MIN || r.hd > QA_LIMITS.HD_PHYS_MAX) {
    hdFail.push(r);
    warn.push(`P${r.point_id}: boy/çap ${r.hd} fiziksel makullük bandı (${QA_LIMITS.HD_PHYS_MIN}–${QA_LIMITS.HD_PHYS_MAX}) dışında — İNCELEME uyarısı; ölçüm/kayıt hatası olabilir, içe aktarmayı BLOKLAMAZ (0031/0032)`);
  } else if (r.hd < QA_LIMITS.HD_MIN || r.hd > QA_LIMITS.HD_MAX) {
    hdBandOut.push(r);
  }
  if (Number.isFinite(r.carbon_stored) && r.carbon_stored > 0) {
    r.dev_pct = +(((r.carbon_stored - r.carbon_calc) / r.carbon_calc) * 100).toFixed(1);
    r.dev_grp_pct = calcGrup.total_carbon > 0 ? +(((r.carbon_stored - calcGrup.total_carbon) / calcGrup.total_carbon) * 100).toFixed(1) : null;
    const rhoSp = rho[r.species] ?? null;
    /* Özel tür ρ'su yoksa calcRow zaten grup varsayılanına düşer. Böyle bir
     * kaydı "tür ρ" diye etiketlemek yanlıştır; tek meşru kaynak gruptur. */
    const okTur = rhoSp != null && uygun(r.carbon_stored, r.carbon_calc);
    const okGrup = uygun(r.carbon_stored, calcGrup.total_carbon);
    if (!okTur && !okGrup) {
      devFail.push(r);
      warn.push(`P${r.point_id}: saklı karbon ${r.carbon_stored} kg ≠ yeniden hesap ${r.carbon_calc} kg (%${r.dev_pct}; grup ρ ile %${r.dev_grp_pct}) — geçerli ρ kaynağıyla bant dışı: ondalık kayması/birim hatası olabilir`);
    } else if (okTur) {
      r.rho_src = 'tur';
    } else {
      r.rho_src = 'grup';
      devRhoGrup.push(r);
      /* Yalnız gerçekten iki farklı ρ adayı varsa kaynak farkını uyarı olarak
       * açıkla. rhoSp=null türlerde grup varsayılanı normal hesap yoludur. */
      if (rhoSp != null && Math.abs(r.dev_pct) > BAND)
        warn.push(`P${r.point_id}: saklı karbon ${r.carbon_stored} kg GRUP VARSAYILANI ρ ile yeniden üretildi (tür ρ ile %${r.dev_pct}) — ρ kaynağı farkı, ÖLÇÜM HATASI DEĞİL (0032)`);
    }
  }
}
if (hdBandOut.length) warn.push(`BİLGİ: ${hdBandOut.length}/${live.length} kayıtta boy/çap tipik ${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX} bandının dışında — bu bir UYARI DEĞİLDİR; geniş gövdeli/bodur form oranı doğal olarak düşürür (0033).`);
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
  unit: { ok: true, note: `${decided.unit} (${decided.why})` },
  /* 0031: boy/çap oranı YALNIZ inceleme göstergesidir → block kalıcı false.
   * 0032: fail = fiziksel olanaksız oran; band_out = tipik bant dışı SAYIM. */
  hd: { fail: hdFail.length, band_out: hdBandOut.length, block: false, review: hdFail.length > 0 },
  dev: { fail: devFail.length, rho_grup: devRhoGrup.length, block: devFail.length >= QA_LIMITS.BLOCK_MIN_N && devFail.length / N > QA_LIMITS.BLOCK_RATIO },
  /* 0033 · gövde çapı dağılımı: BETİMLEYİCİ özet. Kapı DEĞİL, eşik/sınıf
   * değil, yasal statü iddiası hiç değil (bkz. mc.YASAL_STATU_KAPSAM). */
  dbh: (() => {
    const v = live.map((r) => r.dbh_cm).filter((x) => Number.isFinite(x) && x > 0);
    return v.length ? { n: v.length, min: Math.min(...v), medyan: medianOf(v), max: Math.max(...v) } : null;
  })(),
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
  `-- QA: ${live.length} kayıt · h/d fiziksel ihlal ${gates.hd.fail} (tipik bant dışı ${gates.hd.band_out} = bilgi) · karbon sapma ${gates.dev.fail} (grup ρ ile eşleşen ${gates.dev.rho_grup}) · gövde çapı ${gates.dbh ? gates.dbh.min + '–' + gates.dbh.max + ' cm (medyan ' + gates.dbh.medyan + ')' : '—'} · sözlük dışı ${gates.unknown_species} · mükerrer nokta ${gates.dup_points}`,
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
  records: live.map((r) => ({ point_id: r.point_id, species: r.species, grp: r.grp, girth_cm: Number.isFinite(r.girth_cm) ? r.girth_cm : null, dbh_cm: r.dbh_cm, height_m: r.height_m, hd: r.hd, carbon_stored: Number.isFinite(r.carbon_stored) ? r.carbon_stored : null, carbon_calc: r.carbon_calc, dev_pct: Number.isFinite(r.dev_pct) ? r.dev_pct : null, rho_src: r.rho_src ?? null, lat: Number.isFinite(r.lat) ? r.lat : null, lon: Number.isFinite(r.lon) ? r.lon : null })),
  warn: warn.slice(0, 40), errors: errs,
  out: has('dry-run') ? null : outPath,
};
if (has('json')) console.log(JSON.stringify(summary, null, 1));
else {
  console.log(`📥 ${file}: ${recs.length} satır → ${live.length} geçerli kayıt (${delim === '\t' ? 'TSV' : 'CSV:' + delim})`);
  console.log(`📏 birim: ${decided.unit.toUpperCase()} — ${decided.why}`);
  console.log(`🧮 toplam karbon: saklı ${(totStored / 1000).toFixed(2)} t → yeniden hesap ${(totCalc / 1000).toFixed(2)} t${totStored > 0 ? ` (oran ${(totStored / totCalc).toFixed(2)}x)` : ''}`);
  console.log(`🚦 kapılar: boy/çap ${gates.hd.fail}/${live.length}${gates.hd.fail ? ' ⚠İNCELEME' : ''} (tipik bant dışı ${gates.hd.band_out} = ℹ️bilgi) · karbon ${gates.dev.fail}/${live.length}${gates.dev.block ? ' ⛔BLOK' : (gates.dev.fail ? ' ⚠İNCELEME' : '')} (grup ρ ile eşleşen ${gates.dev.rho_grup}) · gövde çapı ${gates.dbh ? gates.dbh.min + '–' + gates.dbh.max + ' cm' : '—'} ℹ️ · sözlük dışı ${gates.unknown_species} · mükerrer ${gates.dup_points} · hata ${errs.length}${gates.geofence ? ` · çit dışı ${gates.geofence.outside}/${gates.geofence.checked}` : ''}`);
  for (const w of warn.slice(0, 15)) console.log('   ⚠ ' + w);
  if (warn.length > 15) console.log(`   … +${warn.length - 15} uyarı daha`);
  for (const e of errs.slice(0, 10)) console.log('   ❌ ' + e);
  if (blocked && !force) { console.log('⛔ QA kapısı BLOK: SQL üretilmedi. Nedenleri giderin veya bilinçli olarak --force kullanın.'); process.exit(1); }
  if (!has('dry-run')) { writeFileSync(outPath, sql); console.log(`✅ SQL yazıldı: ${outPath} — Supabase SQL Editor'da çalıştırın (idempotent).`); }
  else console.log('🧪 dry-run: SQL yazılmadı.');
}
