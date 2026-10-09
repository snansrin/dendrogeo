import { loadRho, QA_LIMITS, QA_STATE, qaStateOf, calcRow as _calcRow, medianOf, madOf, modifiedZ } from './mc.mjs';

/* ENVANTER KALİTE KAPISI: kayıtları kanonik tür sözlüğü ve
 * panel denklemiyle (mc.calcRow) yeniden hesaplar.
 *   (a) Ölçüm protokolü — sahada 1,30 m yükseklikte göğüs çevresi (cm)
 *       ölçülür; ham değer girth_cm'de korunur. DBH çapı = girth_cm / π
 *       olarak türetilir ve dbh_cm alanında tutulur. QA, allometri ve hacim
 *       yalnız bu türetilmiş DBH çapını kullanır.
 *   (b) Gövde formu (boy/çap) — İKİ katmanlı: fiziksel makullük bandı
 *       (HD_PHYS_MIN–HD_PHYS_MAX) + stand İÇİ robust aykırılık (modified
 *       z-score > HD_ROBUST_Z). Tipik bant (HD_MIN–HD_MAX) dışı kayıtlar
 *       yalnız SAYILIR (hd_band_out) ve bilgilendirme olarak beyan edilir;
 *       tek başına hiçbir kayıt için uyarı üretmez. hd_block KALICI false.
 *   (c) Karbon yeniden hesabı — beklenen değer İKİ ρ kaynağıyla hesaplanır
 *       (tür düzeyi ρ / grup varsayılanı ρ). Saklı değer herhangi biriyle
 *       ±CARBON_DEV_PCT içindeyse (veya mutlak fark < CARBON_DEV_MIN_KG)
 *       satır geçerlidir; eşleşen kaynak rho_src alanında ve §7de sayıyla
 *       beyan edilir. Bu, motoru DEĞİŞTİRMEZ: yalnız denetim karşılaştırması.
 *   (d) 0033 ile KALDIRILDI — 0032de eklenen eşik tabanlı gövde sınıfı
 *       beyanı (mevzuat künyesiyle birlikte) rapordan çıkarıldı: DendroGeo
 *       hiçbir bireyin yasal statüsü hakkında hüküm vermez. Yerine gövde
 *       çapı dağılımı (dbh_stats: n/min/medyan/max) YALNIZ betimleyici
 *       olarak raporlanır; eşik, sınıf, puan veya mevzuat atfı yoktur.
 * Kritik ihlal (a)/(c) sistemik ölçekteyse yayın durumu 🔴 BLOKLU olur;
 * aksi hâlde 🟡 İNCELEME / 🟢 GEÇERLİ (mc.qaStateOf).
 *
 * VERİ SAHİBİ KARARI (2026-09-30, 0033 ile güncellendi): Göksu Parkı
 * envanterindeki değerler standart dışı GÖRÜNMEKLE BİRLİKTE DOĞRUDUR.
 * QA v3 bu standı 32/34 kayıtta "olağandışı boy/çap oranı",
 * 6/34 kayıtta "bant dışı karbon" diye işaretleyip 🟡 İNCELEME veriyordu.
 * İki işaretin de kökü ölçüm değil, EŞİK ve ρ KAYNAĞI seçimidir:
 *   · 32/34 oran: sabit 15–120 bandı, bütünüyle geniş gövdeli/bodur formlu bir
 *     standı topluca bayraklar (Göksu h/D aralığı 5,33–16,32; medyan 9,65).
 *     Robust z (eşik 3,5) aynı veride TEK kayıt bayraklamaz.
 *   · Karbon QA artık yalnız FINAL kilitli yoğunluk yoluyla yeniden hesaplanır.\n * QA v5 (0033) aynı veride 🟢 GEÇERLİ hükmü verir ve hiçbir yasal statü
 * iddiası üretmez. Karbon motoru, katsayılar,
 * CSV biçimi, veri tabanı şeması ve yayımlanmış raporlar DEĞİŞMEZ:
 * aynı veri + aynı formül aynı sayıları üretir. */
export function inventoryQa(rows, dict) {
  /* TEK KAYNAK: loadRho() yalnız kilitli tabloyu ve iki grup genelini taşır.
   * Tarihsel/alternatif ρ ile ikinci bir "kabul" hesabı YOKTUR. */
  const base = loadRho();
  const out = {
    n: 0, n_rows: 0, unknown: [], n_unknown: 0, group_fail: [],
    dbh_fail: [], dbh_block: false, dbh_review: false,
    /* (b) hd_fail = İNCELEME üreten kayıtlar (fiziksel bandın dışı VEYA
     * stand içi robust aykırı). hd_band_out = tipik bant dışı SAYIM
     * (bilgilendirme). hd_block kalıcı false (0031 kararı korunur). */
    hd_fail: [], hd_block: false, hd_review: false,
    hd_band_out: [], hd_stats: null, h_fail: [],
    /* (c) dev_rho yalnız FINAL kilit içindeki yetkili kaynağın tür-özel mi
     * yoksa grup-geneli mi olduğunu sayar; alternatif kabul yolu değildir. */
    dev_fail: [], dev_block: false, dev_review: false,
    dev_rho: { n: 0, tur: 0, grup: 0, grup_farkli: [] },
    /* 0033 · gövde çapı dağılımı: BETİMLEYİCİ özet (eşik/sınıf/mevzuat YOK) */
    dbh_stats: null,
    info: [],
    state: QA_STATE.VALID, rows: [],
  };
  for (const r of rows || []) {
    out.n++;
    const dRaw = r.dbh_cm, d = +dRaw, h = +r.height_m, c = +r.carbon_kg;
    const canon = dict.resolve(r.species);
    if (!canon) out.unknown.push(String(r.species));
    /* ---- (a) DBH geçerlilik zinciri (sıra önemli: ilk başarısız halka raporlanır) ---- */
    let dbhReason = null;
    if (dRaw == null || String(dRaw).trim() === '') dbhReason = 'eksik';
    else if (!Number.isFinite(d)) dbhReason = 'sayisal-degil';
    else if (d <= 0) dbhReason = 'pozitif-degil';
    else if (d < QA_LIMITS.DBH_MIN_CM || d > QA_LIMITS.DBH_MAX_CM) dbhReason = 'aralik-disi';
    const dbhFail = dbhReason != null;
    if (dbhFail) out.dbh_fail.push({ point_id: +r.point_id, dbh_cm: Number.isFinite(d) ? d : null, reason: dbhReason });
    /* ---- (b1) gövde formu: fiziksel makullük + tipik bant SAYIMI ---- */
    const hd = (d > 0 && h > 0) ? (100 * h) / d : null; /* birimsiz: h(m) / D(m) */
    const hdBandOut = hd != null && (hd < QA_LIMITS.HD_MIN || hd > QA_LIMITS.HD_MAX);
    if (hdBandOut) out.hd_band_out.push({ point_id: +r.point_id, hd: +hd.toFixed(2) });
    let hdPhys = null;
    if (hd != null && (hd < QA_LIMITS.HD_PHYS_MIN || hd > QA_LIMITS.HD_PHYS_MAX))
      hdPhys = hd < QA_LIMITS.HD_PHYS_MIN ? 'fiziksel-alt' : 'fiziksel-ust';
    const hFail = Number.isFinite(h) && h > 0 && (h < QA_LIMITS.H_MIN_M || h > QA_LIMITS.H_MAX_M);
    if (hFail) out.h_fail.push({ point_id: +r.point_id, height_m: h });
    /* ---- (c) karbon yeniden hesabı: TEK kilitli ρ kaynağı ---- */
    let dev = null, exp = null, devFail = false, rhoSrc = null;
    const spName = canon || String(r.species ?? '');
    const expectedGroup = canon ? base.groupBySpecies[canon] : null;
    if (canon && expectedGroup && expectedGroup !== r.grp)
      out.group_fail.push({ point_id:+r.point_id, species:spName, stored_group:r.grp, expected_group:expectedGroup });
    const rhoSp = canon ? (base.rho[canon] ?? null) : null;
    if (d > 0 && h > 0 && Number.isFinite(c) && c > 0) {
      const calc = _calcRow(d, h, spName, r.grp, base);
      exp = calc.total_carbon;
      const pct = QA_LIMITS.CARBON_DEV_PCT, floor = QA_LIMITS.CARBON_DEV_MIN_KG ?? 0;
      const uyumlu = (x) => x > 0 && (Math.abs(((c - x) / x) * 100) <= pct || Math.abs(c - x) < floor);
      if (exp > 0) dev = +(((c - exp) / exp) * 100).toFixed(1);
      rhoSrc = calc.valid ? (rhoSp != null ? 'tur' : 'grup') : null;
      devFail = !calc.valid || !uyumlu(exp);
      if (devFail) {
        out.dev_fail.push({
          point_id:+r.point_id, stored:c,
          expected:exp > 0 ? +exp.toFixed(1) : null,
          expected_grp:null, dev_pct:dev, dev_grp_pct:null,
          rho_tur:rhoSp, rho_grp:base.grho[r.grp] ?? null,
          reason:calc.valid ? 'karbon-sapmasi' : 'tur-grup-politikasi'
        });
      } else {
        out.dev_rho.n++; out.dev_rho[rhoSrc]++;
      }
    }
    out.rows.push({ id: r.id, point_id: +r.point_id, species: String(r.species ?? ''), canonical: canon, dbh_cm: Number.isFinite(d) ? d : null, dbh_fail: dbhFail, dbh_reason: dbhReason, hd: hd == null ? null : +hd.toFixed(2), hd_band_out: !!hdBandOut, hd_phys_fail: hdPhys, hd_z: null, hd_fail: false, h_fail: !!hFail, stored_carbon_kg: Number.isFinite(c) ? c : null, expected_carbon_kg: exp == null ? null : +exp.toFixed(1), expected_grp_carbon_kg: null, dev_pct: dev, dev_grp_pct: null, dev_fail: devFail, rho_src: rhoSrc, rho_species: rhoSp });
    out.n_rows++;
  }
  /* ---- (b2) stand İÇİ robust aykırılık: modified z-score (Iglewicz–Hoaglin) ----
   * Sabit bant yerine envanterin KENDİ dağılımı ölçüt alınır; böylece
   * bütünüyle geniş gövdeli (veya bütünüyle bodur) formlu standlar topluca
   * "olağandışı" ilan edilmez. n < HD_ROBUST_MIN_N iken test KOŞULMAZ
   * (küçük örneklemden sahte aykırı üretilmez). */
  const hdVals = out.rows.filter((x) => x.hd != null).map((x) => x.hd);
  if (hdVals.length >= QA_LIMITS.HD_ROBUST_MIN_N) {
    const med = medianOf(hdVals), mad = madOf(hdVals, med);
    out.hd_stats = {
      n: hdVals.length,
      medyan: med == null ? null : +med.toFixed(2),
      mad: +mad.toFixed(3),
      min: +Math.min(...hdVals).toFixed(2),
      max: +Math.max(...hdVals).toFixed(2),
      z_esik: QA_LIMITS.HD_ROBUST_Z,
      z_max: 0,
    };
    let zmax = 0;
    for (const x of out.rows) {
      if (x.hd == null) continue;
      const z = modifiedZ(x.hd, med, mad);
      x.hd_z = +z.toFixed(2);
      if (Math.abs(z) > Math.abs(zmax)) zmax = z;
      if (Math.abs(z) > QA_LIMITS.HD_ROBUST_Z) x.hd_fail = true;
    }
    out.hd_stats.z_max = +zmax.toFixed(2);
  }
  for (const x of out.rows) {
    if (x.hd_phys_fail) x.hd_fail = true;
    if (x.hd_fail) out.hd_fail.push({ point_id: x.point_id, hd: x.hd, z: x.hd_z, reason: x.hd_phys_fail || 'stand-aykiri' });
  }
  /* ---- 0033 · gövde çapı dağılımı (betimleyici; eşik/sınıf/mevzuat YOK) ----
   * Rapor bu sayıları yalnız "ölçülen aralık" olarak verir: hiçbir birey için
   * yasal statü, tescil veya benzeri bir hüküm üretilmez. */
  const dbhVals = out.rows.map((x) => x.dbh_cm).filter((x) => Number.isFinite(x) && x > 0);
  out.dbh_stats = dbhVals.length
    ? { n: dbhVals.length, min: Math.min(...dbhVals), medyan: medianOf(dbhVals), max: Math.max(...dbhVals) }
    : null;
  out.unknown = [...new Set(out.unknown)].sort((a, b) => a.localeCompare(b, 'tr'));
  out.n_unknown = out.unknown.length;
  const N = out.n || 1;
  const systemic = (k) => k >= QA_LIMITS.BLOCK_MIN_N && k / N > QA_LIMITS.BLOCK_RATIO;
  /* (a) DBH geçerliliği KRİTİK kontroldür: sistemik ihlal bloklayabilir. */
  out.dbh_block = systemic(out.dbh_fail.length);
  out.dbh_review = out.dbh_fail.length > 0 && !out.dbh_block;
  /* (b) Gövde formu ASLA bloklamaz (0031) — yalnız inceleme. */
  out.hd_block = false;
  out.hd_review = out.hd_fail.length > 0 || out.h_fail.length > 0;
  /* (c) Karbon yeniden hesabı DBH tanımından bağımsız AYRI bir kontroldür. */
  out.dev_block = systemic(out.dev_fail.length);
  out.dev_review = out.dev_fail.length > 0 && !out.dev_block;
  /* Sözlük dışı tür veya katalogla uyuşmayan grup ölçüm politikası ihlalidir. */
  out.species_review = out.n_unknown > 0 || out.group_fail.length > 0;
  /* ρ kaynağı için alternatif kabul/beyan yoktur. */
  out.state = qaStateOf({
    block: out.dbh_block || out.dev_block,
    review: out.dbh_review || out.hd_review || out.dev_review || out.species_review,
  });
  return out;
}

