/* report-v2.test.mjs — RAPOR ŞABLONU v2 bekçileri (2026-09-28 kullanıcı standardı)
 *
 * Kilitlenen sözleşmeler:
 *  1) Belge künyesi: DGR tanımı, durum "Geçerli", resmi beyan, akreditasyon
 *     inkârı; 14 bölüm + Ek A; sertifika dili YASAK.
 *  2) Sonuç/yorum ayrımı: §5 nicel, §8 Değerlendirme yalnız betimleyici.
 *  3) QA/QC: kontrol çizelgesi + alan dengesi SAYILARI (uydurma yok).
 *  4) Parmak izi: engine sürümü, git commit, EPSG, Result Hash, DOI "atanmadı".
 *  5) Tekrar üretilebilirlik + rapor geçmişi (sürüm zinciri) + atıf + kaynakça.
 *  6) metadata.json: DataCite deseninde makine okur üst veri (DOI-hazır).
 *  7) Geometri QA: düğümlü (kendini kesen) poligon sayıyla beyan edilir.
 *  8) Şekil 1 grup renkleri: ibreli yeşil, yapraklı turuncu.
 *  9) harita.png v2: alt bilgi şeridi + belge kimliği + çerçeve.
 * 10) Repo kanıtı: yayımlanmış dizin tutarlı — kimlik/park eşleşmesi,
 *     v2 sayfa ⇔ metadata.json, hash dondurması (şablon sürümünden bağımsız).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { canonicalHash, MC_CFG } from '../scripts/lib/mc.mjs';
import {
  renderReport, buildMetadata, rebuildIndex, mapCanvas, MAP_TONES,
  ringSelfIntersections, geometrySelfIntersections, epsgLabel, fmtDateDot, fmtDateTr,
} from '../scripts/make-report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ---------- sentetik ama GERÇEKÇİ snapshot (LULC dahil) ---------- */
const SNAP2 = {
  schema: 'dendrogeo-report/1',
  park: { id: 5, name: 'Test Parkı', osm_key: 'way/1', city: 'Ankara', country: 'Türkiye', area_m2: 852000 },
  generated_at: '2026-09-28T12:00:00.000Z',
  mc: { ...MC_CFG },
  totals: { n: 3, carbon_kg: 24000, ci: { mean: 24000, lo: 13000, hi: 35000 }, per_ha_kg: 281.7 },
  species: [
    { species: 'SEDİR', grp: 'İBRELİ', n: 2, mean_dbh: 60, mean_h: 11, carbon_kg: 14400, share_pct: 60 },
    { species: 'ÇINAR', grp: 'YAPRAKLI', n: 1, mean_dbh: 90, mean_h: 18, carbon_kg: 9600, share_pct: 40 },
  ],
  gps: { n: 3, mean_acc_m: 6.1 },
  period: { from: '2026-09-03T09:00:00Z', to: '2026-09-06T14:00:00Z' },
  moderation: { approved: 3, reviewed: 3 },
  geofence: { policy: 'park poligonu içinde ölçüm zorunlu (trg_geo_fence, 0007)', total: 3, verified_rows: 3, outside_rows: 0, polygon_source: 'OSM' },
  geometry_qa: { source: 'OSM way/1', ring_points: 25, self_intersections: 0 },
  provenance: { engine: 'DendroGeo LC Engine', engine_version: '4.2.0', app_version: '3.0.0', git_commit: 'abc1234def5678', report_id: 'DGR-2026-0002', epsg: 4326, resolution_m: 10, dataset: 'ESA WorldCover 10 m · 2021 (v200)' },
  lulc: {
    source: 'ESA WorldCover 10 m · 2021 (v200)', citation: 'ESA WorldCover 10 m 2021 v200, CC BY 4.0', year: 2021,
    cross: 'IO LULC 10 m · 2020 (çapraz doğrulama)', crossYear: 2020, crossCitation: 'Impact Observatory Annual LULC v02, CC BY 4.0', crossError: null, agreement: { green: { agreementPct: 91 }, hard: { agreementPct: 84 } },
    areaDeltaPct: 0.059, cells: 8530, coverage_m2: 852500, classified_m2: 852500, epsg: 4326, masked_ha: 0,
    classes: [
      { key: 'green', label: 'Yeşil alan', ha: 69.9, pct: 82 },
      { key: 'hard', label: 'Sert yüzey', ha: 10.23, pct: 12 },
      { key: 'water', label: 'Su', ha: 5.12, pct: 6 },
    ],
  },
  rows: [],
};
const META2 = { id: 'DGR-2026-0002', git_commit: 'abc1234def5678', engine_version: '4.2.0', app_version: '3.0.0', history: [{ id: 'DGR-2026-0001', date: '2026-09-27', retracted: false, note: 'Aynı parkın önceki analizi (bu raporla yenilendi)' }] };
const H2 = canonicalHash(SNAP2);
const html = renderReport(SNAP2, { id: 'DGR-2026-0002', hash: H2, version: 1, meta: META2 });

describe('rapor v2: künye ve resmi çerçeve', () => {
  test('DGR kimliği resmen tanımlı', () => {
    assert.match(html, /DGR — DendroGeo Bilimsel Analiz Raporu/);
  });
  test('belge künyesi alanları tam', () => {
    for (const k of ['Rapor kimliği', 'Rapor durumu', 'Analiz konusu', 'Konum', 'Analiz tarihi', 'Analiz sürümü', 'Veri dönemi', 'Mekânsal çözünürlük'])
      assert.match(html, new RegExp('<b>' + k + '</b>'), k);
    /* 0031: rapor durumu ÇİZELGE 4'ten türetilen üç hâlli rozettir
     * (🔴 BLOKLU / 🟡 İNCELEME / 🟢 GEÇERLİ). Eskiden künyede koşulsuz
     * "Geçerli" yazıyordu — bu, QA sonucu ne olursa olsun basılan yanlış bir
     * hükümdü. Bu fikstürde accuracy_m kaydı yok → GNSS satırı ⚠ → 🟡 İNCELEME. */
    assert.match(html, /class="st (st-ok|st-warn|st-bad)">(🟢 GEÇERLİ|🟡 İNCELEME|🔴 BLOKLU)</, 'üç hâlli durum rozeti');
    assert.match(html, /class="st st-warn">🟡 İNCELEME</, 'GNSS doğruluğu kaydedilmedi → inceleme');
    assert.ok(!/class="st">Geçerli</.test(html), 'eski sabit "Geçerli" rozeti kalkmalı');
    assert.match(html, /veri geçerli; bazı istatistiksel kontroller inceleme uyarısı veriyor/, 'rozet açıklaması');
    assert.match(html, /DendroGeo LC Engine v4\.2\.0/, 'analiz sürümü motor adıyla');
    assert.match(html, /2021 \(arazi örtüsü\)/, 'veri dönemi');
  });
  test('resmi beyan + akreditasyon inkârı (sertifika dili yok)', () => {
    assert.match(html, /belirlenen yöntem, veri kaynakları ve kalite kontrol prosedürleri doğrultusunda oluşturulmuştur/);
    assert.match(html, /akreditasyon veya sertifikasyon belgesi değildir/);
    for (const w of ['Onaylı Bilimsel Rapor', 'Kesin sonuç', '%100 doğruluk', 'Resmî belge', 'Sertifikalı analiz'])
      assert.ok(!html.includes(w), 'yasak iddia: ' + w);
  });
  test('rapor kapsamını ölçülen ağaç kayıtlarıyla açıkça sınırlar', () => {
    assert.match(html, /Ölçülen 3 ağacın/);
    assert.match(html, /yalnızca ölçülen ağaçları kapsar/);
    assert.doesNotMatch(html, /birey(?:sel)?/i);
  });
  test('14 bölüm + Ek A doğru sırayla', () => {
    const sira = ['Analiz Özeti', 'Analiz Alanı', 'Veri Kaynakları', 'Yöntem', 'Nicel Sonuçlar', 'Harita', 'Kalite Kontrol ve Doğrulama', 'Değerlendirme', 'Sınırlılıklar', 'Tekrar Üretilebilirlik', 'Analiz Parmak İzi', 'Rapor Geçmişi', 'Atıf', 'Kaynakça'];
    let last = -1;
    sira.forEach((t, i) => {
      const k = html.indexOf('<span class="no">' + (i + 1) + '</span>' + t);
      assert.ok(k > 0, 'bölüm ' + (i + 1) + ': ' + t);
      assert.ok(k > last, t + ' sırası');
      last = k;
    });
    assert.match(html, /<span class="no">Ek<\/span>A — Veri Erişilebilirliği/);
  });
});

describe('rapor v2: veri kaynakları ve yöntem', () => {
  test('OSM rasterın yerine geçmez — açıkça yazılı', () => {
    assert.match(html, /OSM verisi raster sınıflandırmanın yerine geçmez/);
    assert.match(html, /yalnız sınır geometrisi ve bağımsız kontrol/);
  });
  test('yöntem 4.1–4.5 + kullanıcı standardı cümleleri', () => {
    for (const k of ['4.1 Saha protokolü', '4.2 Biyokütle ve karbon', '4.3 Belirsizlik', '4.4 Arazi örtüsü sınıflandırması', '4.5 Doğrulama zinciri'])
      assert.match(html, new RegExp(k.replace('.', '\\.')));
    assert.match(html, /mekânsal çözünürlüğü 10 m olan raster veri/, 'kullanıcı standardı cümlesi');
    assert.match(html, /ile gerçekleştirilmiştir\. Sınıflandırma sonuçları park geometrisi ile kesiştirilerek değerlendirilmiş; sınır hücrelerinde alan ağırlıklı hesaplama uygulanmıştır/);
    assert.match(html, /Toprak üstü biyokütle \(AGB\)/);
    assert.match(html, /Toprak altı biyokütle/);
    assert.ok(!/Above|Below/i.test(html), 'İngilizce biyokütle terimi yok');
  });
});

describe('rapor v2: sonuç/yorum ayrımı + QA/QC', () => {
  test('§5 nicel: çizelgeler + alan dengesi SAYILARI', () => {
    assert.match(html, /5\.1 Karbon stoku/);
    assert.match(html, /5\.2 Arazi örtüsü/);
    assert.match(html, /5\.3 Alan dengesi/);
    assert.match(html, /Park geometrisi alanı<\/td><td>85,20 ha/);
    assert.match(html, /Analiz edilen alan \(raster kapsama\)<\/td><td>85,25 ha/);
    assert.match(html, /Alan farkı<\/td><td>\+0,05 ha/);
    assert.match(html, /Alan farkı \(%\)<\/td><td>0,059 %/);
  });
  test('§7 QA çizelgesi: kontroller + sonuçlar', () => {
    for (const k of ['Park geometrisi', 'Raster kapsama', 'Alan dengesi', 'Hücre–kesit hesabı', 'Veri kaynağı', 'Sınıflandırma', 'Çapraz doğrulama', 'Konum çiti', 'Moderasyon', 'Rapor üretimi'])
      assert.match(html, new RegExp('<td class="tr">' + k.replace(/[–]/g, '–') + '</td>'), k);
    assert.ok((html.match(/✓ Geçerli/g) || []).length >= 6, 'en az 6 kontrol geçerli');
    assert.match(html, /raster\/park alan farkı %0,059 \(eşik %0,500\)/, 'eşik sayıyla');
    assert.match(html, /8530 kaynak hücre/, 'kapsama sayıları gerçek');
  });
  test('§8 Değerlendirme yalnız betimleyici (normatif dil yok)', () => {
    const i8 = html.indexOf('<span class="no">8</span>Değerlendirme');
    const i9 = html.indexOf('<span class="no">9</span>');
    const sec = html.slice(i8, i9);
    assert.match(sec, /yeşil alan %82,0; sert yüzey %12,0; su %6,0/);
    assert.match(sec, /baskın sınıf %82,0 pay ile Yeşil alan sınıfıdır/);
    assert.match(sec, /parkın ölçülmeyen ağaçlarına genellenmemelidir/);
    assert.match(sec, /normatif değerlendirme/, 'ayrım beyanı');
    assert.ok(!/çok iyi|mükemmel|harika|yetersiz durumda|başarılı bir park/.test(sec), 'yorum dili sızmadı');
  });
  test('§9 sınırlılıklar: çözünürlük + OSM beyanları', () => {
    assert.match(html, /küçük ve dar yüzeylerin bağımsız olarak temsil edilmesini her durumda mümkün kılmayabilir/);
    assert.match(html, /eksik veya güncel olmayan OSM geometrileri analiz sonucunun tek başına belirleyicisi değildir/);
    assert.match(html, /pantropikal bir modeldir/);
  });
});

describe('rapor v2: parmak izi + tekrar üretilebilirlik + geçmiş', () => {
  test('§11 parmak izi alanları gerçek değerlerle', () => {
    for (const k of ['Analysis ID', 'Engine version', 'Source dataset', 'Resolution', 'Projection', 'Git commit', 'Generated', 'Result hash', 'DOI'])
      assert.match(html, new RegExp('<b>' + k + '</b>'), k);
    assert.match(html, /<code>4\.2\.0<\/code>/);
    assert.match(html, /<code>abc1234<\/code>/, 'commit kısa gösterim');
    assert.match(html, /EPSG:4326 \(WGS 84 coğrafi\)/);
    assert.ok(html.includes('sha256:' + H2), 'tam sonuç hash’i');
    assert.match(html, /DOI<\/b><code id="dgReportDoi">atanmadı<\/code>/);
    assert.match(html, /Zenodo\/DataCite/, 'DOI yolu beyanı');
  });
  test('§10 tekrar üretilebilirlik tablosu + dürüst uyarı', () => {
    assert.match(html, /DendroGeo LC Engine 4\.2\.0 · uygulama 3\.0\.0/);
    assert.match(html, /node scripts\/make-report\.mjs --park 5/, 'üretim komutu');
    assert.match(html, /kayıt altına alınmıştır/);
    assert.match(html, /kaynak ürünün yeni sürümleri yeniden üretim sonucunu etkileyebilir/, 'bulut girdisi dürüstlüğü');
  });
  test('§12 geçmiş: önceki DGR + ilk yayımlama + değişmezlik notu', () => {
    assert.match(html, /DGR-2026-0001/, 'önceki analiz');
    assert.match(html, /İlk yayımlama/, 'bu rapor');
    assert.match(html, /geri çekilir/, 'düzeltme yolu');
    assert.match(html, /yayin-kuyrugu\.json/, 'denetim izi');
  });
});

describe('rapor v2: atıf + kaynakça + makine okur üst veri', () => {
  test('önerilen atıf + DOI notu + BibTeX', () => {
    assert.match(html, /Önerilen atıf/);
    assert.match(html, /DendroGeo Bilimsel Analiz Raporu, DGR-2026-0002 \(sürüm 1\.0\)/);
    assert.match(html, /@techreport\{dgr20260002/);
    assert.match(html, /version   = \{1\.0\}/);
    assert.match(html, /Gerçek DOI kaydı oluşturulduğunda/, 'DOI ikame notu');
  });
  test('kaynakça DOI/kalıcı bağlantılarla', () => {
    assert.match(html, /10\.5281\/zenodo\.7254221/, 'WorldCover 2021 v200 Zenodo DOI');
    assert.match(html, /10\.1111\/gcb\.12629/, 'Chave 2014 DOI');
    assert.match(html, /openstreetmap\.org\/copyright/, 'ODbL');
    assert.match(html, /yontem\//, 'DendroGeo yöntem dokümanı');
  });
  test('JSON-LD gömülü ve ayrıştırılabilir', () => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(m, 'ld+json bloğu');
    const j = JSON.parse(m[1]);
    const md = buildMetadata(SNAP2, { id: 'DGR-2026-0002', hash: H2, version: '1.0', meta: META2, history: META2.history });
    assert.equal(j['@type'], 'Report');
    assert.equal(j.reportNumber, 'DGR-2026-0002');
    assert.equal(j.version, '1.0');
    assert.equal(j.name, md.title, 'sayfa, atıf ve metadata aynı rapor başlığını kullanır');
    assert.equal(j.softwareVersion, md.applicationVersion);
    assert.equal(j.measurementTechnique, md.methodVersion);
    assert.deepEqual(j.isBasedOn, md.sources, 'JSON-LD kaynak listesi metadata ile eşleşir');
    assert.deepEqual(j.additionalProperty[1].value, md.sourceProvenance, 'kaynak kökeni JSON-LD ile metadata arasında eşleşir');
    assert.equal(j.additionalProperty[2].value, md.resultHash);
    assert.ok(j.identifier.some((x) => x.propertyID === 'SHA-256' && x.value === H2));
    assert.match(j.citation[0], /DendroGeo Bilimsel Analiz Raporu, DGR-2026-0002/);
    assert.equal(j.temporalCoverage, '2021');
    assert.match(html, /href="metadata\.json"/, 'metadata bağlantısı');
  });
  test('buildMetadata: DataCite deseni (DOI-hazır)', () => {
    const md = buildMetadata(SNAP2, { id: 'DGR-2026-0002', hash: H2, version: '1.0', meta: META2, history: META2.history });
    assert.equal(md.identifier, 'DGR-2026-0002');
    assert.equal(md.identifierType, 'DGR');
    assert.match(md.identifierDescription, /DendroGeo Bilimsel Analiz Raporu/);
    assert.equal(md.publicationYear, 2026);
    assert.equal(md.resourceType, 'Scientific Analysis Report');
    assert.equal(md.resourceTypeGeneral, 'Report');
    assert.equal(md.version, '1.0');
    assert.equal(md.engineVersion, '4.2.0');
    assert.equal(md.applicationVersion, '3.0.0');
    assert.equal(md.language, 'tr');
    assert.equal(md.resolution, '10 m');
    assert.equal(md.temporalCoverage, '2021');
    assert.equal(md.doi, null);
    assert.match(md.doiNote, /IsIdenticalBy/);
    assert.equal(md.resultHash, 'sha256:' + H2);
    assert.equal(md.gitCommit, 'abc1234def5678');
    assert.deepEqual(md.sourceProvenance.primary, { name: 'ESA WorldCover 10 m · 2021 (v200)', version: 2021, citation: 'ESA WorldCover 10 m 2021 v200, CC BY 4.0' });
    assert.deepEqual(md.sourceProvenance.crossValidation, { name: 'IO LULC 10 m · 2020 (çapraz doğrulama)', version: 2020, citation: 'Impact Observatory Annual LULC v02, CC BY 4.0', status: 'completed' });
    assert.ok(md.sources.includes('IO LULC 10 m · 2020 (çapraz doğrulama) — Impact Observatory Annual LULC v02, CC BY 4.0'));
    const rels = md.relatedIdentifiers;
    assert.ok(rels.some((r) => r.relatedIdentifier === '10.5281/zenodo.7254221' && r.relationType === 'IsDerivedFrom'));
    assert.ok(rels.some((r) => r.relationType === 'IsSupplementedBy' && /github\.com\/snansrin\/dendrogeo\/commit\/abc1234/.test(r.relatedIdentifier)));
    assert.ok(rels.some((r) => r.relationType === 'IsNewVersionOf' && r.relatedIdentifier === 'DGR-2026-0001'));
    assert.equal(md.history[md.history.length - 1].status, 'Geçerli');
  });
  test('kabul edilmiş yüzey analizinin revizyonu ve girdi parmak izleri metadata’da korunur', () => {
    const snap = structuredClone(SNAP2);
    snap.lulc.review = { schema: 'dendrogeo-surface/2', revision: 7, acceptedAt: '2026-10-04T12:00:00.000Z', sourceFingerprint: 'source-abc', objectFingerprint: 'objects-def' };
    const md = buildMetadata(snap, { id: 'DGR-2026-0002', hash: canonicalHash(snap), version: '1.0', meta: META2, history: META2.history });
    assert.deepEqual(md.sourceProvenance.acceptedSurface, { schema: 'dendrogeo-surface/2', revision: 7, acceptedAt: '2026-10-04T12:00:00.000Z', sourceFingerprint: 'source-abc', objectFingerprint: 'objects-def' });
  });
  test('yayın formundaki ORCID rapor ve makine okur yaratıcı bilgisine aktarılır', () => {
    const snap = structuredClone(SNAP2);
    snap.author = { name: 'Örnek Araştırmacı' };
    snap.publication = { schema: 'dendrogeo-publication/1', title: 'Kent parkı envanteri', project: 'Park araştırması', researcher: 'Örnek Araştırmacı', institution: 'Örnek Üniversite', department: '', supervisor: '', orcid: '0000-0002-1825-0097', purpose: 'Karbon stokunun belirlenmesi.', sampling: 'Onaylı ağaç ölçüm kayıtları.', instruments: 'Çap ve boy ölçer.', funding: '', study_type: 'research', start_date: '2026-09-01', end_date: '2026-09-28' };
    const hash = canonicalHash(snap);
    const html = renderReport(snap, { id: 'DGR-2026-0002', hash, version: 1, meta: META2 });
    const md = buildMetadata(snap, { id: 'DGR-2026-0002', hash, version: '1.0', meta: META2, history: META2.history });
    const jsonld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(md.creators[0].nameIdentifiers, [{ nameIdentifier: '0000-0002-1825-0097', nameIdentifierScheme: 'ORCID', schemeUri: 'https://orcid.org' }]);
    assert.equal(jsonld.author[0].identifier, 'https://orcid.org/0000-0002-1825-0097');
    assert.match(html, /href="https:\/\/orcid\.org\/0000-0002-1825-0097"/);
  });
});

describe('rapor v2: geometri QA (düğümlü poligon beyanı)', () => {
  const KNOT = {
    ...SNAP2,
    geometry_qa: { source: 'parks.geom_json (uygulamada çizilen sınır)', ring_points: 25, self_intersections: 9 },
    lulc: { error: 'Raster/park alanı QA başarısız: 1.70% fark.' },
  };
  const hk = renderReport(KNOT, { id: 'DGR-2026-0002', hash: canonicalHash(KNOT), version: 1 });
  test('düğüm sayısı §2 + §7 + §9’da sayıyla beyan', () => {
    assert.match(hk, /9 kendini kesen segment çifti/);
    assert.match(hk, /⚠ Düğümlü sınır/, 'QA satırı durumu');
    assert.match(hk, /qwarn/, 'uyarı rengi');
    assert.match(hk, /Sınırın uygulamada yeniden çizilmesi/, 'öneri');
    assert.match(hk, /Saptanan neden/, '§4.4 neden açıklaması');
  });
  test('LULC yokken raster QA satırları çizilmez (uydurma yok)', () => {
    assert.ok(!hk.includes('Raster kapsama'), 'kapsama satırı yok');
    assert.ok(!hk.includes('Alan farkı'), 'alan dengesi tablosu yok');
    assert.match(hk, /Bu sürümde arazi örtüsü çözümlemesi yer almamaktadır/);
  });
  test('ringSelfIntersections: kare temiz, papyon düğümlü', () => {
    assert.equal(ringSelfIntersections([[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]), 0);
    assert.equal(ringSelfIntersections([[0, 0], [0, 2], [2, 0], [2, 2], [0, 0]]), 1);
    assert.equal(geometrySelfIntersections([[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]], [[[0.5, 0.5], [0.5, 1.5], [1.5, 0.5], [1.5, 1.5], [0.5, 0.5]]]), 1, 'delik de taranır');
  });
  test('epsgLabel + fmtDateDot birimleri', () => {
    assert.equal(epsgLabel(4326), 'EPSG:4326 (WGS 84 coğrafi)');
    assert.equal(epsgLabel(32636), 'EPSG:32636 (UTM 36N)');
    assert.equal(epsgLabel(null), null);
    assert.equal(fmtDateDot('2026-09-28T12:00:00Z'), '28.09.2026');
    assert.equal(fmtDateTr('2026-09-28T12:00:00Z'), '28 Eylül 2026');
  });
});

describe('rapor v2: harita PNG üst bilgisi', () => {
  const outer = [[0, 0], [0, 0.02], [0.02, 0.02], [0.02, 0]];
  const wruns = [{ lo0: 0, lo1: 0.02, la0: 0, la1: 0.02, key: 'green' }];
  const classes = { green: { label: 'Yeşil alan', color: '#4ade80', areaM2: 40000 } };
  const meta = { id: 'DGR-2026-0009', epsg: 4326, dateStr: '28.09.2026', source: 'ESA WORLDCOVER 2021 V200', engine: '4.2.0' };
  const cv = mapCanvas({ outer, wruns, classes, parkName: 'TEST PARKI', sub: 'KAYNAK', points: [], meta });
  const px = (x, y) => [cv.px[(y * cv.w + x) * 4], cv.px[(y * cv.w + x) * 4 + 1], cv.px[(y * cv.w + x) * 4 + 2]];
  test('alt bilgi şeridi ayracı çizili + yükseklik rezervi', () => {
    const legRows = 4; /* green + border + point + outside */
    const H = 96 + 540 + 16 + legRows * 28 + 18 + 70;
    assert.equal(cv.h, H, 'FOOT=70 rezervli');
    const fy = H - 70 + 12;
    const p = px(40, fy - 8);
    assert.deepEqual(p, [206, 210, 206], 'ayraç çizgisi');
  });
  test('belge kimliği sağ üstte mürekkepli', () => {
    let ink = 0;
    for (let x = cv.w - 200; x < cv.w - 20; x += 3)
      for (let y = 10; y < 28; y += 2) {
        const c = px(x, y);
        if (c[0] !== MAP_TONES.out[0] || c[1] !== MAP_TONES.out[1] || c[2] !== MAP_TONES.out[2]) ink++;
      }
    assert.ok(ink > 20, 'id metni çizildi (' + ink + ' piksel)');
  });
  test('PNG geçerli kodlanıyor', () => {
    const buf = cv.encode();
    assert.ok(buf.length > 1000 && buf[1] === 0x50);
  });
});

describe('rapor v2: liste yeniden kurulumu', () => {
  test('yalnız data.json taşıyan dizinler listelenir (geri çekilen düşer)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dgr-idx-'));
    mkdirSync(join(tmp, 'DGR-2026-0001'));
    writeFileSync(join(tmp, 'DGR-2026-0001', 'data.json'), JSON.stringify({
      park: { name: 'A Parkı' }, totals: { n: 2, ci: { mean: 24000, lo: 13000, hi: 35000 } }, generated_at: '2026-09-27T10:00:00Z',
    }));
    mkdirSync(join(tmp, 'DGR-2026-0002')); /* geri çekilmiş: data.json yok */
    writeFileSync(join(tmp, 'DGR-2026-0002', 'index.html'), '<html>bildirim</html>');
    const list = rebuildIndex(tmp);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'DGR-2026-0001');
    const idx = readFileSync(join(tmp, 'index.html'), 'utf8');
    assert.match(idx, /DGR-2026-0001/);
    assert.ok(!idx.includes('DGR-2026-0002/'), 'geri çekilen listelenmez');
    assert.match(idx, /Durum/, 'durum sütunu');
    assert.match(idx, /Geçerli/, 'rozet');
    assert.match(idx, /geri çekme kayıtları/, 'geri çekme açıklaması');
  });
});

describe('repo kanıtı: yayımlanmış rapor dizini tutarlı (şablondan bağımsız)', () => {
  /* Yayımlanmış rapor DEĞİŞMEZ: DGR-2026-0001 ve DGR-2026-0002 eski (v1)
   * şablonda donmuştur; v2 şablonu bu sürümden sonra üretilen raporlarda
   * görünür. Bu blok tek bir rapora değil, dizindeki TÜM raporlara uygulanan
   * değişmezlere bakar — böylece şablon sürümü ne olursa olsun kilit tutar.
   * Kilitlenen asıl risk: kimlik/park çakışması (yanlış DGR’nin yanlış parka
   * bağlanması) ve üst veri hash’inin snapshot’tan sapması. */
  const RAP = join(ROOT, 'rapor');
  const dirs = existsSync(RAP) ? readdirSync(RAP).filter((d) => /^DGR-\d{4}-\d{4}$/.test(d)).sort() : [];
  const LOG = join(RAP, 'yayin-kuyrugu.json');
  const pub = JSON.parse(readFileSync(LOG, 'utf8')).entries.filter((e) => e.status === 'Yayınlandı');
  const live = dirs.filter((d) => existsSync(join(RAP, d, 'data.json')));

  test('dizin satırı doğru parkı gösterir (kimlik çakışması kilidi)', () => {
    assert.ok(dirs.length > 0, 'rapor/ altında yayın var');
    const idx = readFileSync(join(RAP, 'index.html'), 'utf8');
    const rows = [...idx.matchAll(/<tr><td><a href="(DGR-\d{4}-\d{4})\/">[^<]*<\/a><\/td><td class="tr">([^<]*)<\/td>/g)];
    assert.equal(rows.length, live.length, 'liste = data.json taşıyan yayınlar');
    for (const [, id, parkName] of rows) {
      const data = JSON.parse(readFileSync(join(RAP, id, 'data.json'), 'utf8'));
      assert.equal(parkName, data.park.name, id + ': listedeki park = snapshot parkı');
      const e = pub.find((x) => x.report_id === id);
      if (e) assert.equal(e.park_id, data.park.id, id + ': günlükteki park kimliği = snapshot');
    }
  });

  test('v2 sayfa ⇔ metadata.json; hash ve harita tutarlı', () => {
    for (const d of dirs) {
      const p = join(RAP, d, 'index.html');
      if (!existsSync(p)) continue; /* geri çekilmiş: yalnız bildirim kalır */
      const h = readFileSync(p, 'utf8');
      const v2 = h.includes('Analiz Parmak İzi');
      assert.equal(v2, existsSync(join(RAP, d, 'metadata.json')), d + ': v2 şablon ⇔ metadata.json');
      assert.equal(/og:image/.test(h), existsSync(join(RAP, d, 'harita.png')), d + ': og:image ⇔ harita.png');
      if (!v2) continue; /* eski şablon donduruldu: dokunulmaz */
      assert.match(h, /DGR — DendroGeo Bilimsel Analiz Raporu/);
      assert.match(h, /Rapor Geçmişi/);
      assert.match(h, /Kaynakça/);
      const md = JSON.parse(readFileSync(join(RAP, d, 'metadata.json'), 'utf8'));
      const data = JSON.parse(readFileSync(join(RAP, d, 'data.json'), 'utf8'));
      assert.equal(md.identifier, d);
      assert.equal(md.version, '1.0');
      assert.equal(md.resultHash, 'sha256:' + canonicalHash(data), d + ': üst veri hash’i snapshot’la aynı');
      if (data.geometry_qa && data.geometry_qa.self_intersections > 0)
        assert.match(h, /⚠ Düğümlü sınır/, d + ': düğümlü sınır beyanı sayfada');
    }
  });

  test('günlükteki hash yayımlanmış sayfada görünür (dondurma kanıtı)', () => {
    assert.ok(pub.length > 0, 'günlükte yayın kaydı var');
    /* 0010: geri çekilen yayının adresinde bildirim sayfası kalır; o sayfa
     * içerik hash'i TAŞIMAZ (veri dosyalarıyla birlikte hash de kaldırılır).
     * Dondurma kanıtı yalnız GEÇERLİ yayınlar için anlamlıdır. */
    const retracted = new Set((() => {
      try { return (JSON.parse(readFileSync(LOG, 'utf8')).entries || []).filter((x) => x.status === 'Geri çekildi').map((x) => String(x.report_id)); }
      catch (e) { return []; }
    })());
    for (const e of pub) {
      if (retracted.has(String(e.report_id))) continue;
      const p = join(RAP, e.report_id, 'index.html');
      if (!existsSync(p) || !e.report_hash) continue;
      assert.ok(readFileSync(p, 'utf8').includes(e.report_hash.replace('sha256:', '')), e.report_id + ': hash sayfada');
    }
  });

  test('şablon sabitleri lc-config tek kaynağından', () => {
    assert.match(read('src/services/lc-config.js'), /const DG_LC_ENGINE_VERSION="4\.2\.0";/);
    assert.match(read('scripts/make-report.mjs'), /DG_LC_ENGINE_VERSION\\s\*=/);
  });
});
