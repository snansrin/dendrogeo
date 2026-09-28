/* scripts/lib/mc.mjs — Monte Carlo belirsizlik + özet istatistikler (saf, ESM)
 *
 * Rapor üretim hattının sayısal çekirdeği. Tarayıcı koduna BAĞLI DEĞİLDİR;
 * hem scripts/make-report.mjs hem test/rapor.test.mjs bunu kullanır →
 * rapordaki sayılar ile testteki beklentiler aynı kaynaktan türer.
 *
 * MODEL (belgelenmiş, tek yerden değişir):
 *   AGB  = 0.0673 · (ρ · D² · H)^0.976          [Chave et al. 2014]
 *   BGB  = 0.26 · AGB ;  C = 0.47 · (AGB+BGB)
 *   girdi hatası: D ~ N(D, 0.5 cm), H ~ N(H, 0.25 m)
 *   model hatası: çarpan (1 + z·CV), CV=0.22 ; TOPLAMDA çarpan kayıtlar arası
 *                 KORELEDİR (aynı denklem ortak sapma üretir) → bağımsız
 *                 varsayımının yapay daralttığı aralıklardan kaçınılır.
 *   örneklem: mulberry32 + sabit seed → aynı veri aynı aralık (hakem tekrarı).
 */
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const MC_CFG = { N: 1000, SEED: 20260926, DBH_SD_CM: 0.5, H_SD_M: 0.25, MODEL_CV: 0.22, CONF: 0.95 };

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normPair(rnd) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  const m = Math.sqrt(-2 * Math.log(u));
  return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)];
}
/* ---- tür sözlüğü (vm ile gerçek çalıştırma) ----
 * ESKİ HATA (0011 öncesi): loadRho, species.js'i regex ile tarıyordu
 * (/"([^"]+)"\s*:\s*([\d.]+)/). Ama species.js satırları {tr:"GÖKNAR",
 * lat:"…",rho:350} biçiminde — anahtarlar TIRNAKSIZ. Regex bu yüzden tek
 * bir tür yoğunluğu bile yakalayamıyor, rapor hattı TÜM türleri grup
 * varsayılanıyla (446/541) hesaplıyordu. Panel (vm + gerçek global'ler)
 * ile rapor arasındaki sessiz fark buradan çıkıyordu.
 * Çözüm: dosyayı test-harness ile AYNI biçimde vm'de çalıştırıp gerçek
 * nesneleri okumak. Regex ile şema ayrıştırma YASAK. */
function speciesContext() {
  const ctx = vm.createContext({ Math, JSON, Object, Array, String, Number });
  vm.runInContext(readFileSync(join(ROOT, 'src/config/species.js'), 'utf8'), ctx, { filename: 'species.js' });
  vm.runInContext('globalThis.__X={SPECIES_DATA,GROUP_DEFAULT_RHO,LATIN,resolveSpeciesName,normSp};', ctx);
  return ctx.__X;
}
export function loadRho() {
  const X = speciesContext();
  const rho = {};
  for (const g of Object.values(X.SPECIES_DATA))
    for (const s of g) if (s.rho) rho[s.tr] = s.rho;
  const grho = Object.assign({}, X.GROUP_DEFAULT_RHO);
  return { rho, grho };
}
/* Kanonik tür sözlüğü: ad → {lat, rho, grp}; eşanlamlı çözümleyici ile.
 * İçe aktarma aracı ve rapor QA kapısı aynı sözlüğü kullanır (tek gerçek). */
export function loadSpeciesDict() {
  const X = speciesContext();
  const { rho, grho } = loadRho();
  const byName = {};
  for (const [g, list] of Object.entries(X.SPECIES_DATA))
    for (const s of list) byName[s.tr] = { tr: s.tr, lat: s.lat, rho: rho[s.tr] ?? null, grp: g };
  return { byName, grho, resolve: (n) => X.resolveSpeciesName(n), norm: (n) => X.normSp(n) };
}
/* ---- envanter QA eşikleri (0011 · Göksu bulgularıyla kalibre) ----
 * HD_MIN: boy/çap oranı BİRİMSİZ tanımlıdır: h(m) / (dbh(cm)/100) = 100·h/D.
 *   Olgun park ağaçlarında ~20-100'dur. Oran < 15 ise
 *   "çap" kolonu büyük olasılıkla ÇEVRE'dir (DBH = çevre/π) — Göksu'da
 *   34/34 kayıt 5-16 aralığındaydı; çevre yorumu ile 17-51'e oturdu ve
 *   saha fotoğraflarıyla doğrulandı.
 * HD_MAX: oran > 120 ise çap mm girilmiş olabilir (÷10).
 * Kayıtların yarısından fazlası (ve en az BLOCK_MIN_N kayıt) eşik dışındaysa
 * YAYIN KAPISI BLOKLAR; tekil bodur/abartılı bireyler uyarıdır, blok değil. */
export const QA_LIMITS = { HD_MIN: 15, HD_MAX: 120, CARBON_DEV_PCT: 20, BLOCK_RATIO: 0.5, BLOCK_MIN_N: 3 };
/* Panel motoruyla (src/services/allometry.js calc) BİREBİR aynı denklem —
 * rapor/içe aktarma hattındaki yeniden hesap bu fonksiyondan türer. */
export function calcRow(dbh_cm, height_m, speciesName, grp, { rho, grho }) {
  const d = parseFloat(dbh_cm), h = parseFloat(height_m);
  if (!(d > 0) || !(h > 0)) return { agb: 0, bhb: 0, bio: 0, c_agb: 0, c_bhb: 0, total_carbon: 0, vol: 0 };
  const r = (rho[speciesName] || grho[grp] || grho['DİĞER'] || 0.5) / 1000;
  const agb = 0.0673 * Math.pow(r * d * d * h, 0.976);
  const bhb = agb * 0.26;
  return { agb, bhb, bio: agb + bhb, c_agb: agb * 0.47, c_bhb: bhb * 0.47, total_carbon: (agb + bhb) * 0.47, vol: Math.PI * Math.pow(d / 200, 2) * h * 0.5 };
}

export function carbonKg(row, { rho, grho }) {
  const d = parseFloat(row.dbh_cm), h = parseFloat(row.height_m);
  if (!(d > 0) || !(h > 0)) return 0;
  const r = (rho[row.species] || grho[row.grp] || grho['DİĞER'] || 0.5) / 1000;
  const agb = 0.0673 * Math.pow(r * d * d * h, 0.976);
  return (agb + agb * 0.26) * 0.47;
}
export function percentile(sorted, p) {
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
export function summarize(samples, conf = MC_CFG.CONF) {
  const s = [...samples].sort((a, b) => a - b);
  const mean = s.reduce((a, x) => a + x, 0) / s.length;
  const sd = Math.sqrt(s.reduce((q, x) => q + (x - mean) ** 2, 0) / Math.max(1, s.length - 1));
  const a = (1 - conf) / 2;
  return { mean, lo: percentile(s, a), hi: percentile(s, 1 - a), sd, n: s.length };
}
export function mcRowCI(row, cfg = {}) {
  const c = { ...MC_CFG, ...cfg };
  const { rho, grho } = loadRho();
  const rnd = mulberry32((c.SEED | 0) ^ ((row.id || row.point_id || 7) * 2654435761));
  const base = carbonKg(row, { rho, grho });
  const point = Number.isFinite(+row.carbon_kg) && +row.carbon_kg > 0 ? +row.carbon_kg : base;
  const out = new Array(c.N);
  for (let i = 0; i < c.N; i++) {
    const [z1, z2] = normPair(rnd), zm = normPair(rnd)[0];
    const d = Math.max(0.5, parseFloat(row.dbh_cm) + z1 * c.DBH_SD_CM);
    const h = Math.max(0.5, parseFloat(row.height_m) + z2 * c.H_SD_M);
    const pert = carbonKg({ ...row, dbh_cm: d, height_m: h }, { rho, grho });
    out[i] = point * (base > 0 ? pert / base : 1) * (1 + zm * c.MODEL_CV);
  }
  const m = out.reduce((a, x) => a + x, 0) / out.length;
  if (m > 0) for (let i = 0; i < out.length; i++) out[i] *= point / m;   // merkezleme
  return summarize(out, c.CONF);
}
export function mcTotalCI(rows, cfg = {}) {
  const c = { ...MC_CFG, ...cfg };
  const list = (rows || []).filter((r) => Number.isFinite(+r.dbh_cm) && Number.isFinite(+r.height_m));
  if (!list.length) return { mean: 0, lo: 0, hi: 0, sd: 0, n: 0 };
  const { rho, grho } = loadRho();
  const stored = list.reduce((a, r) => a + (Number.isFinite(+r.carbon_kg) && +r.carbon_kg > 0 ? +r.carbon_kg : carbonKg(r, { rho, grho })), 0);
  const rndM = mulberry32((c.SEED | 0) ^ 0x9E3779B9);
  const per = list.map((r) => ({ r, base: carbonKg(r, { rho, grho }), point: Number.isFinite(+r.carbon_kg) && +r.carbon_kg > 0 ? +r.carbon_kg : carbonKg(r, { rho, grho }), rnd: mulberry32((c.SEED | 0) ^ ((r.id || r.point_id || 7) * 2654435761)) }));
  const sums = new Array(c.N);
  for (let i = 0; i < c.N; i++) {
    const f = 1 + normPair(rndM)[0] * c.MODEL_CV;      // KORELE model çarpanı
    let t = 0;
    for (const p of per) {
      const [z1, z2] = normPair(p.rnd);                 // bağımsız ölçüm hatası
      const d = Math.max(0.5, parseFloat(p.r.dbh_cm) + z1 * c.DBH_SD_CM);
      const h = Math.max(0.5, parseFloat(p.r.height_m) + z2 * c.H_SD_M);
      const pert = carbonKg({ ...p.r, dbh_cm: d, height_m: h }, { rho, grho });
      t += p.point * (p.base > 0 ? pert / p.base : 1) * f;
    }
    sums[i] = t;
  }
  const m = sums.reduce((a, x) => a + x, 0) / sums.length;
  if (m > 0 && stored > 0) for (let i = 0; i < sums.length; i++) sums[i] *= stored / m;  // merkezleme: nokta tahmin = saklı toplam
  const o = summarize(sums, c.CONF);
  o.n = list.length;
  return o;
}
export function canonicalHash(obj) {
  /* instanceof DEĞİL duck-typing: vm realm'inden gelen nesnelerde instanceof
   * false döner ve anahtar sıralaması atlanırdı → hash realm'e bağımlı olurdu. */
  const stable = (v) => JSON.stringify(v, (k, val) => (val !== null && typeof val === 'object' && !Array.isArray(val)
    ? Object.keys(val).sort().reduce((o, key) => (o[key] = val[key], o), {})
    : val));
  return createHash('sha256').update(stable(obj)).digest('hex');
}
export const fmtT = (kg) => (kg / 1000).toFixed(2);
export const fmtCI = (ci) => `${fmtT(ci.mean)} t [%95 GA: ${fmtT(ci.lo)}–${fmtT(ci.hi)}]`;
