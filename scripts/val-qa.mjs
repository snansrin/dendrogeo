#!/usr/bin/env node
/* val-qa.mjs — ÇALIŞMA SAHASI v5 CANLI UÇTAN UCA KANIT KOŞUSU
 *
 * lulc-qa.mjs'nin kardeşi: gerçek park poligonu (Supabase public.parks veya
 * Overpass) → dgLcAnalyze (WorldCover 2021 + IO LULC çapraz) → dgS2Profile
 * (Sentinel-2 L2A bulutsuz medyan kompozit) → dgValAgreement (otomatik
 * uzlaşma) → tabakalı örneklem + Olofsson karne matematiği.
 *
 *   node scripts/val-qa.mjs --park-id 25            (DB'deki park kimliği)
 *   node scripts/val-qa.mjs --park "Göksu Parkı"    (Overpass'ten polygon)
 *   node scripts/val-qa.mjs --park-id 25 --s2-mode ytd (2026: yılbaşından bugüne)
 *
 * NOT: "karne" bölümünde referans olarak SPEKTRAL tahmin kullanılır — bu
 * yalnız hattın plumbing kanıtıdır; bilimsel referans İNSAN etiketidir
 * (uygulamadaki B adımı). Sayısal alan sonuçlarına DOKUNMAZ (salt okur). */
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Bound CLI lookups too; Node needs --use-env-proxy in proxied environments.
const nativeFetch=globalThis.fetch;
async function fetch(url,options={}){
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000);
 const started=Date.now();
 try{const response=await nativeFetch(url,{...options,signal});
  if(process.argv.includes('--verbose'))console.log('HTTP',response.status,new URL(url).hostname,Date.now()-started+' ms');
  return response;
 }catch(e){if(process.argv.includes('--verbose'))console.error('HTTP failed',new URL(url).hostname,e.name);throw e;}
}
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (ad) => { const i = process.argv.indexOf('--' + ad); return i >= 0 ? process.argv[i + 1] : null; };
const PARK_ID = Number(arg('park-id') || 0);
const PARK_ADI = arg('park');
const VISUAL_SAMPLES_OUT = arg('visual-samples-out');
const VISUAL_SAMPLES_ONLY = process.argv.includes('--visual-samples-only');
const S2_MODE = ['ref','latest','ytd'].includes(arg('s2-mode')) ? arg('s2-mode') : 'ref';
const SB_URL = 'https://xjbpounwdxrhelmixvqm.supabase.co';
const SB_ANON = readFileSync(join(ROOT, 'src/config/supabase.js'), 'utf8').match(/SB_KEY="([^"]+)"/)[1];

/* ---------- park poligonu ---------- */
async function parkFromDb(id) {
  const r = await fetch(`${SB_URL}/rest/v1/parks?id=eq.${id}&select=id,name,city,geom_json`,
    { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON } });
  const j = await r.json();
  if (!j.length) throw new Error('park #' + id + ' bulunamadı');
  const p = j[0];
  if (!p.geom_json || !p.geom_json.outer) throw new Error('park #' + id + ' geom_json taşımıyor');
  const rings = p.geom_json.outer;
  const outer = Array.isArray(rings[0][0]) ? rings : [rings];
  return { outer, meta: { name: p.name, city: p.city, osm: 'supabase.parks#' + p.id } };
}
async function parkFromOverpass(ad) {
  const nr = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&limit=1&q=' +
    encodeURIComponent(ad + ', '+(arg('city')||'Türkiye')), { headers: { 'User-Agent': 'dendrogeo-val-qa/1.0' } });
  const nj = await nr.json();
  if (!nj.length) throw new Error('Nominatim bulamadı: ' + ad);
  const named=nj[0],geometry=named.geojson;
  if(named.category==='leisure'&&named.type==='park'&&['Polygon','MultiPolygon'].includes(geometry?.type)){
    const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
    return {outer:polygons.map(p=>p[0].map(([lon,lat])=>[lat,lon])),holes:polygons.flatMap(p=>p.slice(1).map(r=>r.map(([lon,lat])=>[lat,lon]))),meta:{name:ad,city:arg('city')||'',osm:'nominatim:'+named.osm_type+'/'+named.osm_id}};
  }
  const lat = Number(nj[0].lat), lon = Number(nj[0].lon);
  const q = `[out:json][timeout:60];nwr["leisure"="park"]["name"~"${ad}",i](around:4000,${lat},${lon});out geom;`;
  const AYNALAR = ['https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter'];
  let j = null;
  for (const url of AYNALAR) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'dendrogeo-val-qa/1.0', 'Accept': 'application/json' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(90000) });
      if (r.ok) { j = await r.json(); break; }
    } catch (e) { /* sonraki ayna */ }
  }
  if (!j) throw new Error('Overpass erişilemedi');
  let ring = null, en = -1;
  for (const el of j.elements || []) {
    let r2 = null;
    if (el.type === 'way') r2 = (el.geometry || []).map(g => [g.lat, g.lon]);
    else {
      const outerM = (el.members || []).filter(m => m.role === 'outer' || m.role === '');
      r2 = [];
      for (const m of outerM) for (const g of (m.geometry || [])) r2.push([g.lat, g.lon]);
    }
    if (r2 && r2.length > en) { en = r2.length; ring = r2; }
  }
  if (!ring || ring.length < 4) throw new Error('park poligonu çıkarılamadı');
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push([ring[0][0], ring[0][1]]);
  return { outer: [ring], meta: { name: ad, city: '', osm: 'overpass' } };
}

const src = PARK_ID ? await parkFromDb(PARK_ID) : await parkFromOverpass(PARK_ADI || 'Göksu Parkı');
console.log(`🌳 AOI: ${src.meta.name} (${src.meta.osm}) · ${src.outer[0].length} köşe`);

/* ---------- vm: gerçek fetch + vendor GeoTIFF + TAM zincir ---------- */
function shimIsci(ctx) {
  ctx.Worker = class { constructor(u) { this.url = String(u); } postMessage() { throw new Error('worker yolu beklenmiyordu'); } terminate() {} addEventListener() {} removeEventListener() {} };
  if (!ctx.URL.createObjectURL) ctx.URL.createObjectURL = () => 'blob:qa-fake';
  ctx.Blob = ctx.Blob || class { constructor() {} };
}
const ctx = {
  console, fetch, setTimeout, clearTimeout, URL, URLSearchParams,
  Map, Set, Math, JSON, Date, Number, Array, Object, String, Boolean,
  Promise, RegExp, Error, Intl, isNaN, parseInt, parseFloat,
  ArrayBuffer, Uint8Array, Uint16Array, Int16Array, Int32Array, Float32Array,
  Float64Array, DataView, TextDecoder, TextEncoder, AbortController,
  Response, Headers, Request, Buffer,
  S2_MODE,
  window: null, document: { createElement: () => ({}) },
  navigator: { userAgent: 'node-qa' }, location: { origin: 'https://qa.local' },
};
shimIsci(ctx);
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(join(ROOT, 'vendor/geotiff-2.1.3.js'), 'utf8'), ctx, { filename: 'geotiff.js' });
for (const f of ['src/config/constants.js',
  'src/services/lc-config.js', 'src/domain/surface/classify-landcover-code.js',
  'src/domain/surface/compare-source-class-areas.js',
  'src/services/lc-geo.js', 'src/services/lc-stac.js',
  'src/domain/surface/merge-tile-results.js', 'src/adapters/surface/result-exports.js',
  'src/application/surface/analyze-source.js',
  'src/adapters/surface/process-landcover-tile.js',
  'src/services/lc-engine.js',
  'src/services/lc-osm.js', 'src/domain/surface/patch-geometry.js', 'src/domain/surface/group-patch-cells.js', 'src/domain/surface/measure-patch-components.js', 'src/domain/surface/query-green-patches.js', 'src/services/lc-patches.js',
  'src/services/lc-validate.js', 'src/services/lc-s2.js',
  'src/ui/lc-report.js', 'src/domain/surface/quality-gates.js', 'src/contracts/surface-analysis.js',
  'src/application/surface/run-analysis.js', 'src/services/landcover.js']) {
  vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx, { filename: f });
}

const script = `(async () => {
  const outer = ${JSON.stringify(src.outer)};
  const holes = ${JSON.stringify(src.holes||[])};
  const geom = dgLcProjectGeometry(outer, holes, dgLcUtmEpsgForLatLon(outer[0][0][0], outer[0][0][1]));
  const parkAreaM2 = dgLcProjectedArea(geom);
  const t0 = Date.now();
  console.log('WorldCover analizi başladı.');
  const report = await dgLcAnalyze({ outer, holes, parkAreaM2 });
  const cells = DG_LC_LAST.result.cells;
  const tA = Date.now() - t0;

  /* Stratified mapped-class samples estimate class-wise agreement. A separate
   * park-wide random frame can reveal classes absent from the mapped strata. */
  const samples = dgValStratifiedSample(cells, { perStratum: 10, seed: 20261003 });
  const visualSamples=[...samples.map(s=>({...s,frame:"stratified"})),...dgValSpatialSample(cells,{count:20,seed:20261007})];
  if(${JSON.stringify(VISUAL_SAMPLES_ONLY)})return{visualSamples,parkAreaHa:parkAreaM2/10000,cellCount:cells.length};

  const t1 = Date.now();
  console.log('WorldCover tamamlandı; Sentinel-2 taraması başladı.');
  const profileYear = S2_MODE === 'ytd' ? new Date().getUTCFullYear() : 2021;
  const profile = await dgS2Profile(cells, outer, { year: profileYear, mode: S2_MODE });
  dgS2PredictAll(profile);
  const tB = Date.now() - t1;

  const agreement = dgValAgreement(cells, profile.cells);

  const labeled = samples.map(s => {
    const sp = profile.cells[s.row + ':' + s.col];
    const pred = sp ? dgValSpectralPredict(sp) : 'nodata';
    return { mapClass: s.mapClass, refClass: pred === 'nodata' ? 'ambiguous' : pred };
  });
  const conf = dgValConfusion(labeled);
  const W = dgValWeights(DG_LC_LAST.result.groupAreas, DG_LC_LAST.result.assignedAreaM2);
  const metrics = dgValMetrics(conf, W, DG_LC_LAST.result.assignedAreaM2);
  const gate = dgValGate(metrics, agreement, labeled.length);

  const med = arr => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const idxByClass = {};
  for (const c of cells) {
    const sp = profile.cells[c.row + ':' + c.col];
    if (!sp || sp.ndvi === undefined) continue;
    const b = (idxByClass[c.classKey] = idxByClass[c.classKey] || { ndvi: [], mndwi: [], ndbi: [] });
    b.ndvi.push(sp.ndvi); b.mndwi.push(sp.mndwi); b.ndbi.push(sp.ndbi);
  }
  const idxSummary = {};
  for (const k of Object.keys(idxByClass)) idxSummary[k] = { n: idxByClass[k].ndvi.length, ndvi: med(idxByClass[k].ndvi), mndwi: med(idxByClass[k].mndwi), ndbi: med(idxByClass[k].ndbi) };

  /* UYUŞMAZLIK TEŞHİSİ: harita sınıfı × spektral tahmin matrisi + su
   * hücrelerinin MNDWI yüzdelikleri (eşik tartışmasının kanıtı). */
  const pct = (arr, q) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
  const disMatrix = {};
  const waterMndwi = [];
  for (const c of cells) {
    if (Number(c.areaM2 || 0) < 60) continue;
    const sp = profile.cells[c.row + ':' + c.col];
    const pred = sp ? dgValSpectralPredict(sp) : 'nodata';
    if (c.classKey === 'water' && sp && sp.mndwi !== undefined) waterMndwi.push(sp.mndwi);
    if (pred === c.classKey || pred === 'ambiguous' || pred === 'nodata') continue;
    disMatrix[c.classKey] = disMatrix[c.classKey] || {};
    disMatrix[c.classKey][pred] = (disMatrix[c.classKey][pred] || 0) + 1;
  }

  return {
    parkAreaHa: parkAreaM2 / 10000,
    classes: report.classes,
    xagree: report.agreement,
    waterRefined: report.waterRefinedCells, roadRefined: report.roadRefinedCells,
    tA_ms: tA, tB_ms: tB, cellCount: cells.length,
    s2: { scenes: profile.scenes, range: profile.range.label, stats: profile.stats, skipped: profile.skipped, waterScenes: profile.waterScenes || [] },
    autoAgreement: { overallPct: agreement.overallPct, n: agreement.nCandidates, perClass: agreement.perClass, flagged: agreement.flagged.length },
    idxSummary, sampleCount: samples.length,
    /* Görsel inceleme için deterministik örneklem çerçevesi.
     * Otomatik Sentinel tahmini referans etiketi olarak yazılmaz. */
    visualSamples,
    disMatrix,
    /* COK ZAMANLI KANIT KATKISI: yillik max alanlari olmadan (yalniz yaz
     * medyani) tahmin vs yillik kanitla tahmin — kac hucre sinif degistirdi. */
    yearGain: (() => {
      let waterSaved = 0, greenSaved = 0, total = 0;
      for (const c of cells) {
        const sp = profile.cells[c.row + ':' + c.col];
        if (!sp || sp.ndvi === undefined) continue;
        total++;
        const withYear = dgValSpectralPredict(sp);
        const noYear = dgValSpectralPredict({ ndvi: sp.ndvi, mndwi: sp.mndwi, ndbi: sp.ndbi, obs: sp.obs });
        if (withYear !== noYear) {
          if (withYear === 'water' && c.classKey === 'water') waterSaved++;
          if (withYear === 'green' && c.classKey === 'green') greenSaved++;
        }
      }
      return { total, waterSaved, greenSaved };
    })(),
    rawCounts: report.rawCounts,
    /* su grubu hücrelerinin HAM ESA kodu × spektral tahmin çaprazı:
     * 80 (açık su) ile 90 (otsu sulak) ayrımı uzlaşmazlığın TANIMSAL mı
     * gerçek hata mı olduğunu söyler. */
    waterRawVsSpec: (() => {
      const t = {};
      for (const c of cells) {
        if (c.classKey !== 'water' || Number(c.areaM2 || 0) < 60) continue;
        const sp = profile.cells[c.row + ':' + c.col];
        const pred = sp ? dgValSpectralPredict(sp) : 'nodata';
        const rc = String(c.classCode);
        t[rc] = t[rc] || {};
        t[rc][pred] = (t[rc][pred] || 0) + 1;
      }
      return t;
    })(),
    waterMndwiPct: { p10: pct(waterMndwi, 0.10), p25: pct(waterMndwi, 0.25), p50: pct(waterMndwi, 0.50), p75: pct(waterMndwi, 0.75), n: waterMndwi.length },
    waterDis: (() => {
      /* UYUŞMAYAN su hücreleri: yıllık MAX MNDWI ve ndviMax dağılımı.
       * maxYear ≥0.45 çoksa → birleştirme/tahmin hatası; düşükse → hücreler
       * fiziksel olarak sazlık/sığ (WorldCover 80 aşırı genellemesi). */
      const my = [], nv = [];
      for (const c of cells) {
        if (c.classKey !== 'water' || Number(c.areaM2 || 0) < 60) continue;
        const sp = profile.cells[c.row + ':' + c.col];
        if (!sp) continue;
        if (dgValSpectralPredict(sp) === 'water') continue;
        my.push(sp.mndwiMaxYear === undefined ? sp.mndwiMax : sp.mndwiMaxYear);
        nv.push(sp.ndviMax === undefined ? sp.ndvi : sp.ndviMax);
      }
      return { n: my.length, maxYearP25: pct(my, 0.25), maxYearP50: pct(my, 0.50), maxYearP75: pct(my, 0.75), ndviMaxP50: pct(nv, 0.50), ndviMaxP75: pct(nv, 0.75) };
    })(),
    metrics: { oa: metrics.oa, kappa: metrics.kappa },
    gate: { state: gate.state, label: gate.label, reasons: gate.reasons.length },
  };
})()`;
const out = await vm.runInContext(script, ctx, { filename: 'val-qa', timeout: 600000 });

if(VISUAL_SAMPLES_OUT){
  const payload={schema:'dendrogeo-visual-sample/1',park:src.meta,seed:20261003,randomSeed:20261007,perStratum:10,randomPerPark:20,
    imagery:'Esri World Imagery (MapServer tile service)',createdAt:new Date().toISOString(),
    note:'mapClass is only the mapped stratum. stratified points estimate class-wise agreement; park-random points provide an independent omission check. Assign refClass only after visual interpretation.',
    samples:out.visualSamples};
  await writeFile(VISUAL_SAMPLES_OUT,JSON.stringify(payload,null,2)+'\n');
  console.log(`\nGörüntü örneklemi yazıldı: ${VISUAL_SAMPLES_OUT} (${out.visualSamples.length} nokta)`);
  if(VISUAL_SAMPLES_ONLY)process.exit(0);
}

console.log('\n══ A) WorldCover 2021 — değişmez ham raster ══');
console.log(`park: ${out.parkAreaHa.toFixed(2)} ha · hücre: ${out.cellCount} · süre: ${(out.tA_ms / 1000).toFixed(1)} sn · su rafine: ${out.waterRefined} · yol rafine: ${out.roadRefined}`);
for (const [k, v] of Object.entries(out.classes)) console.log(`  ${k.padEnd(6)} ${String(v.areaHa).padStart(8)} ha  %${String(v.pct).padStart(6)}`);
if (out.xagree) for (const [k, v] of Object.entries(out.xagree)) console.log(`  çapraz-uzlaşma ${k.padEnd(6)} %${v.agreementPct.toFixed(1)}`);

console.log(`\n══ B) Sentinel-2 L2A medyan kompozit · ${S2_MODE} ══`);
console.log(`dönem: ${out.s2.range} · süre: ${(out.tB_ms / 1000).toFixed(1)} sn`);
console.log(`sahneler: ${out.s2.scenes.map(s => s.datetime + ' ☁%' + s.cloud).join(' | ')}`);
console.log(`profilli: ${out.s2.stats.nProfiled}/${out.s2.stats.nCells} · yetersiz: ${out.s2.stats.nInsufficient} · atlanan: ${out.s2.skipped.length}`);
console.log(`su-kalıcılığı sahneleri: ${out.s2.waterScenes.length} → ${out.s2.waterScenes.map(w => w.datetime + '(' + w.window.slice(0, 9) + ')☁%' + w.cloud).join(' | ') || 'YOK'}`);

console.log('\n══ C) Sınıf bazında indeks medyanları (fizik sağduyusu) ══');
for (const [k, v] of Object.entries(out.idxSummary)) console.log(`  ${k.padEnd(6)} n=${String(v.n).padStart(5)}  NDVI ${v.ndvi === null ? '—' : v.ndvi.toFixed(3)}  MNDWI ${v.mndwi === null ? '—' : v.mndwi.toFixed(3)}  NDBI ${v.ndbi === null ? '—' : v.ndbi.toFixed(3)}`);

console.log('\n══ D) Otomatik uzlaşma (harita ↔ spektral) ══');
console.log(`genel: %${out.autoAgreement.overallPct} (${out.autoAgreement.n} aday · ${out.autoAgreement.flagged} uyuşmazlık)`);
for (const [k, v] of Object.entries(out.autoAgreement.perClass)) console.log(`  ${k.padEnd(6)} ${v.pct === null ? '—' : '%' + v.pct}  (✓${v.agree} ✗${v.disagree} ❓${v.ambiguous} ⬜${v.nodata} kenar:${v.edge})`);

console.log('\n══ D2) Uyuşmazlık teşhisi (harita → spektral) ══');
for (const [k, v] of Object.entries(out.disMatrix)) console.log('  ' + k.padEnd(6) + ' → ' + Object.entries(v).map(([p, n]) => p + ':' + n).join(', '));
const wd = out.waterDis;
console.log('  UYUŞMAYAN su hücreleri (n=' + wd.n + '): yıllık maxMNDWI p25 ' + (wd.maxYearP25 ?? 0).toFixed(3) + ' · p50 ' + (wd.maxYearP50 ?? 0).toFixed(3) + ' · p75 ' + (wd.maxYearP75 ?? 0).toFixed(3) + ' | ndviMax p50 ' + (wd.ndviMaxP50 ?? 0).toFixed(3) + ' · p75 ' + (wd.ndviMaxP75 ?? 0).toFixed(3));
const wp = out.waterMndwiPct;
console.log('  su MNDWI yüzdelikleri (n=' + wp.n + '): p10 ' + (wp.p10 ?? 0).toFixed(3) + ' · p25 ' + (wp.p25 ?? 0).toFixed(3) + ' · p50 ' + (wp.p50 ?? 0).toFixed(3) + ' · p75 ' + (wp.p75 ?? 0).toFixed(3));

console.log('\n══ D3) Ham ESA kod dağılımı + su grubu kod×spektral çaprazı ══');
console.log('  rawCounts:', JSON.stringify(out.rawCounts));
for (const [rc, v] of Object.entries(out.waterRawVsSpec)) console.log('  ESA ' + rc + ' → ' + Object.entries(v).map(([p2, n2]) => p2 + ':' + n2).join(', '));

console.log('  cok-zamanli kanit katkisi: yillik max ile sinifi DUZELEN hucre → su +' + out.yearGain.waterSaved + ', yesil +' + out.yearGain.greenSaved + ' (toplam ' + out.yearGain.total + ')');

console.log('\n══ E) Karne plumbing (spektral sahte-referans — bilimsel hüküm değil) ══');
console.log(`örnek: ${out.sampleCount} · OA: %${(out.metrics.oa * 100).toFixed(1)} · κ: ${out.metrics.kappa === null ? '—' : out.metrics.kappa.toFixed(2)} · kapı: ${out.gate.label} (${out.gate.reasons} sebep)`);

