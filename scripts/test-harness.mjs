/* test-harness.mjs — Uygulama dosyalarını Node içinde, DOM olmadan çalıştırmak
 * için minimal yalıtım katmanı.
 *
 * Neden gerekli: Bu proje build adımı olmayan, klasik <script> etiketleriyle
 * yüklenen bir SPA. Tüm fonksiyonlar global kapsama yazılıyor ve dosyalar
 * birbirinin global'lerini kullanıyor (allometry.js → species.js'teki `rho`,
 * landcover.js → geo.js'teki WebMercator yardımcıları). Doğrudan `import`
 * edilemezler.
 *
 * Çözüm: node:vm içinde bir bağlam oluşturup dosyaları index.html'deki YÜKLEME
 * SIRASIYLA çalıştırmak. DOM'a dokunan kod Proxy stub'ı tarafından emilir, ağ
 * istekleri bilinçli olarak reddedilir (birim testleri Planetary Computer'a
 * veya Supabase'e gitmemeli).
 *
 * ⚠️ TEST YAZARKEN ÜÇ TUZAK (üçü de bu testler yazılırken yaşandı):
 *
 * 1) const/let bildirimleri vm bağlamının "global lexical scope"unda kalır ve
 *    ctx NESNESİNDE ÖZELLİK OLARAK GÖRÜNMEZ. Yani ctx.rho === undefined olur.
 *    function bildirimleri normal global nesne özelliğine dönüştüğü için onlar
 *    görünür; yalnızca const/let kaybolur. Aşağıdaki LEXICAL epilog bunu
 *    typeof korumasıyla dışa aktarır (çıplak referans ReferenceError verir).
 *
 * 2) assert.deepEqual / deepStrictEqual ÇALIŞMAZ. Dönen nesneler vm bağlamının
 *    realm'inden gelir ve Object.prototype'ı farklıdır; Node "Values have same
 *    structure but are not reference-equal" der. Anahtar kümesini ve değerleri
 *    AYRI AYRI karşılaştırın.
 *
 * 3) Kayan nokta sabitlerini elle yazmayın. Uygulama `rho[sp]/1000` bölmesi
 *    yapar; testte 0.478 yazarsanız son basamakta ~1e-6 mutlak (~5e-9 bağıl)
 *    fark kalır ve sıkı tolerans yanlış alarm verir. Ya bağıl tolerans kullanın
 *    ya da aynı bölmeyi yapan bir yardımcı yazın.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const stub = new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => '' : stub),
  apply: () => stub,
  construct: () => stub,
  set: () => true,
});

/**
 * Uygulama global'lerini yükler ve bağlamı döndürür.
 * @param {string[]} sadece - yalnızca bu dosyaları yükle (varsayılan: hepsi)
 */
export function loadApp({ sadece } = {}) {
  const ctx = {
    window: null, document: stub, navigator: stub, location: stub,
    localStorage: stub, sessionStorage: stub, indexedDB: stub, caches: stub,
    L: stub, Chart: stub, supabase: stub, GeoTIFF: stub,
    alert: () => {}, confirm: () => false,
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    URL, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date, Number, Array,
    Object, String, Boolean, Promise, RegExp, Error, Intl, isNaN, parseInt,
    parseFloat, TextEncoder, TextDecoder,
    fetch: () => Promise.reject(new Error('Birim testlerinde ağ erişimi yok')),
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  const SIRALAMA = [
    'src/config/constants.js',
    'src/config/measurement-protocol-lock.js',
    'src/config/wood-density-lock.js',
    'src/config/species.js',
    'src/utils/geo.js',
    'src/utils/truncation.js',
    'src/domain/trees/photo-quality.js',
    'src/domain/trees/allometry.js',
    'src/application/trees/calculate-tree-carbon.js',
    'src/application/trees/calculate-tree-carbon-from-circumference.js',
    'src/application/trees/validate-measurement.js',
    'src/services/allometry.js',
    /* LULC ZİNCİRİ (Faz 5): index.html'deki sırayla. ui/lc-report facade'tan
     * ÖNCE yüklenmeli (facade dgLcRenderReport'u yükleme anında referanslar). */
    'src/services/lc-config.js',
    'src/domain/surface/classify-landcover-code.js',
    'src/domain/surface/compare-source-class-areas.js',
    'src/services/lc-geo.js',
    'src/services/lc-stac.js',
    'src/domain/surface/merge-tile-results.js',
    'src/adapters/surface/result-exports.js',
    'src/application/surface/analyze-source.js',
    'src/adapters/surface/process-landcover-tile.js',
    'src/services/lc-engine.js',
    'src/services/lc-osm.js',
    'src/domain/surface/patch-geometry.js', 'src/domain/surface/group-patch-cells.js', 'src/domain/surface/measure-patch-components.js', 'src/domain/surface/query-green-patches.js',
    'src/domain/surface/review-geometry.js',
    'src/adapters/surface/review-store.js',
    'src/adapters/surface/osm-review-objects.js',
    'src/adapters/surface/review-worker.js',
    'src/application/surface/prepare-review.js',
    'src/application/surface/merge-review-features.js',
    'src/services/lc-patches.js',
    /* UYDU HASSASİYET (0054): validate çekirdeği saf matematiktir (eşikler,
     * hassasiyet, Olofsson metrikleri, düzeltme katmanı) — birim testleri
     * buradan yüklenir. lc-s2 ağ/GeoTIFF katmanıdır; sabitleri ve saf
     * yardımcıları (dgS2Median, dgS2SeasonRange) test edilir.
     * ui/lc-sens BİLEREK yok (DOM'a yapışır; park-panel gibi statik
     * denetimden geçer). */
    'src/services/lc-validate.js',
    'src/services/lc-s2.js',
    'src/ui/lc-report.js',
    'src/domain/surface/quality-gates.js',
    'src/contracts/surface-analysis.js',
    'src/application/surface/run-analysis.js',
    'src/services/landcover.js',
    'src/application/visitors/build-live-activity.js',
    'src/application/visitors/build-live-roster.js',
    /* PARK ZİNCİRİ (Faz 4): eski gridplan.js'in mantık modülleri, index.html'deki
     * yükleme sırasıyla. UI modülleri (src/ui/park-panel, src/ui/park-export)
     * BİLEREK yüklenmez — DOM'a yapışırlar; onları ui-audit statik tarar. */
    'src/services/park-state.js',
    'src/services/osm-client.js',
    'src/domain/parks/road-half-width.js',
    'src/domain/parks/classify-surface-tags.js',
    'src/domain/parks/impervious-geometry.js',
    'src/domain/parks/area.js',
    'src/domain/parks/resolve-park-area.js',
    'src/domain/parks/segment-intersection.js',
    'src/domain/parks/point-in-polygon.js',
    'src/domain/parks/bounds.js',
    'src/domain/parks/park-containment.js',
    'src/domain/parks/line-distance.js',
    'src/domain/parks/osm-rings.js',
    'src/domain/parks/rect-intersection.js',
    'src/domain/parks/cell-in-park.js',
    'src/domain/parks/cell-validity.js',
    'src/domain/parks/park-overlap.js',
    'src/services/park-geometry.js',
    'src/domain/parks/simplify-ring.js',
    'src/adapters/parks/park-geometry-store.js',
    'src/application/parks/persist-park-geometry.js',
    /* KONUM DOĞRULAMASI (0007): saf karar fonksiyonu dgGeoDecide birim testleri
     * bu zincirden yüklenir (DOM/ağ yok). */
    'src/services/geofence.js',
    'src/application/parks/find-park-candidates.js',
    'src/application/parks/fetch-detailed-coverage.js',
    'src/application/parks/classify-coverage-elements.js',
    'src/application/parks/find-nominatim-boundary.js',
    'src/adapters/parks/nominatim-client.js',
    'src/services/park-query.js',
    /* PARK KİMLİĞİ (2026-09-24): park-registry.js saf yardımcılarının
     * (ad normalizasyonu, anahtar üretimi, proje adı kuralı) birim testleri
     * bu zincirden yüklenir. ui/park-panel BİLEREK yok (DOM'a yapışır). */
    'src/domain/parks/identity.js',
    'src/adapters/parks/park-store.js',
    'src/application/parks/register-park.js',
    'src/adapters/parks/project-store.js',
    'src/application/parks/create-project.js',
    'src/adapters/parks/project-link-store.js',
    'src/application/parks/link-project.js',
    'src/application/parks/detect-park.js',
    'src/application/parks/create-manual-park.js',
    'src/adapters/parks/park-search.js',
    'src/application/parks/search-park-by-name.js',
    'src/domain/parks/is-schema-error.js',
    'src/application/parks/build-park-admin-overview.js',
    'src/ui/park-admin-renderer.js',
    'src/application/parks/merge-park-identities.js',
    'src/application/parks/rename-park-identity.js',
    'src/application/parks/delete-park-identity.js',
    'src/application/parks/load-admin-park-identities.js',
    'src/application/parks/plan-park-backfill.js',
    'src/application/parks/apply-park-backfill.js',
    'src/application/parks/create-backfill-park.js',
    'src/application/parks/backfill-park-geometry.js',
    'src/adapters/parks/fetch-osm-park-ring.js',
    'src/application/parks/detect-backfill-park.js',
    'src/adapters/parks/search-osm-park-by-name.js',
    'src/application/parks/evaluate-measurement-park-gate.js',
    'src/ui/park-identity.js',
    'src/ui/park-backfill-plan.js',
    'src/ui/park-backfill-progress.js',
    'src/services/park-registry.js',
    'src/application/parks/build-grid-waypoint-rows.js',
    'src/application/parks/count-grid-cell-measurements.js',
    'src/application/parks/build-grid-request.js',
    'src/application/parks/is-grid-waypoint-context-current.js',
    'src/application/parks/resolve-grid-waypoint-readiness.js',
    'src/application/parks/select-grid-waypoint-cells.js',
    'src/application/parks/prepare-grid-surface-parts.js',
    'src/application/parks/resolve-grid-cell-style.js',
    'src/application/parks/count-grid-cell-states.js',
    'src/application/parks/grid-review-signature.js',
    'src/application/parks/prepare-grid-waypoint-batch.js',
    'src/adapters/parks/fetch-latest-grid-waypoint.js',
    'src/adapters/parks/insert-grid-waypoints.js',
    'src/adapters/parks/fetch-grid-measurement-candidates.js',
    'src/domain/parks/grid-options.js',
    'src/domain/parks/grid-bounds.js',
    'src/domain/parks/grid-cell-shape.js',
    'src/services/grid-engine.js',
    /* YÖNETİM AĞACI (2026-09-24): dgTreeGroup/dgTreeFilterRows saf
     * fonksiyonları burada test edilir (DOM'a dokunan çizim kısmı değil). */
    'src/services/admin-tree.js',
  ];
  const secim = sadece ? new Set(sadece) : null;
  if (secim && (secim.has('src/config/species.js') || secim.has('src/services/allometry.js'))) {
    secim.add('src/config/measurement-protocol-lock.js');
    secim.add('src/config/wood-density-lock.js');
    secim.add('src/domain/trees/allometry.js');
    secim.add('src/application/trees/calculate-tree-carbon.js');
    secim.add('src/application/trees/calculate-tree-carbon-from-circumference.js');
  }
  if (secim && secim.has('src/services/measure.js')) secim.add('src/application/trees/validate-measurement.js');
  if (secim && secim.has('src/services/visit-stats.js')) {
    secim.add('src/application/visitors/build-live-activity.js');
    secim.add('src/application/visitors/build-live-roster.js');
  }
  if (secim && secim.has('src/services/park-query.js')) {
    secim.add('src/application/parks/find-park-candidates.js');
    secim.add('src/application/parks/fetch-detailed-coverage.js');
    secim.add('src/application/parks/classify-coverage-elements.js');
    secim.add('src/application/parks/find-nominatim-boundary.js');
    secim.add('src/adapters/parks/nominatim-client.js');
  }
  if (secim && secim.has('src/services/park-registry.js')) {
    secim.add('src/ui/park-identity.js');
    secim.add('src/ui/park-backfill-plan.js');
    secim.add('src/ui/park-backfill-progress.js');
    secim.add('src/application/parks/merge-park-identities.js');
    secim.add('src/application/parks/rename-park-identity.js');
    secim.add('src/application/parks/delete-park-identity.js');
    secim.add('src/application/parks/load-admin-park-identities.js');
    secim.add('src/application/parks/plan-park-backfill.js');
    secim.add('src/application/parks/apply-park-backfill.js');
    secim.add('src/application/parks/create-backfill-park.js');
    secim.add('src/application/parks/backfill-park-geometry.js');
    secim.add('src/adapters/parks/fetch-osm-park-ring.js');
    secim.add('src/application/parks/detect-backfill-park.js');
    secim.add('src/adapters/parks/search-osm-park-by-name.js');
    secim.add('src/application/parks/evaluate-measurement-park-gate.js');
    secim.add('src/domain/parks/is-schema-error.js');
    secim.add('src/domain/parks/identity.js');
    secim.add('src/adapters/parks/park-store.js');
    secim.add('src/application/parks/register-park.js');
    secim.add('src/adapters/parks/project-store.js');
    secim.add('src/application/parks/create-project.js');
    secim.add('src/adapters/parks/project-link-store.js');
    secim.add('src/application/parks/link-project.js');
    secim.add('src/application/parks/detect-park.js');
    secim.add('src/application/parks/create-manual-park.js');
    secim.add('src/adapters/parks/park-search.js');
    secim.add('src/application/parks/search-park-by-name.js');
  }
  if (secim && secim.has('src/services/landcover.js')) {
    secim.add('src/domain/surface/quality-gates.js');
    secim.add('src/contracts/surface-analysis.js');
    secim.add('src/application/surface/run-analysis.js');
  }
  const dosyalar = secim ? SIRALAMA.filter((f) => secim.has(f)) : SIRALAMA;

  const LEXICAL = ['DG_MEASUREMENT_PROTOCOL_PAYLOAD','DG_MEASUREMENT_PROTOCOL_LOCK',
                   'WOOD_DENSITY_LOCK_ID','WOOD_DENSITY_LOCK_FINGERPRINT','WOOD_DENSITY_CANONICAL',
                   'MEASUREMENT_GROUPS','SPECIES_DATA','GROUP_DEFAULT_RHO','SPECIES_GROUP',
                   'species','rho','LATIN','GROUP_COLOR','SPECIES_SYNONYMS','QUOTA_MB','esc','$',
                   'DG_LC_CODES', 'DG_LC_CLASSES', 'DG_LC_PIXEL_M', 'DG_LC_YEAR',
                   'DG_LC_COLLECTION', 'DG_LC_STAC', 'DG_LC_MAX_TILES',
                   'DG_LC_MAX_READ_PIXELS', 'DG_LC_RENDER_LIMIT',
                   'DG_LC_SOURCES', 'DG_ESA_GROUP', 'DG_ESA_CODES', 'DG_LC_SAS', 'DG_OSM_WATER_MIRRORS', 'DG_LC_LAYER', 'DG_LC_LAST',
                   /* Çalışma Sahası v5 (2026-10-03) */
                   'DG_VAL_VERSION', 'DG_VAL_CLASSES', 'DG_VAL_LABELS', 'DG_VAL_DEFAULTS',
                   'DG_VAL_SPECTRAL', 'DG_VAL_GATE',
                   'DG_S2_COLLECTION', 'DG_S2_MAX_SCENES', 'DG_S2_MAX_CLOUD', 'DG_S2_SEARCH_LIMIT',
                   'DG_S2_BANDS', 'DG_S2_SCL_VALID', 'DG_S2_SCALE', 'DG_S2_MIN_OBS_GUARD',
                   'DG_TRUNCATION_WARNED',
                   'DG_PARK_SEP', 'DG_PARK_MATCH_M', 'DG_TR_FOLD', 'DG_TR_UP'];
  const epilog = LEXICAL
    .map((n) => `if(typeof ${n}!=="undefined")__exports.${n}=${n};`)
    .join('');

  ctx.__exports = {};
  for (const f of dosyalar) {
    vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx, { filename: f });
    vm.runInContext(epilog, ctx, { filename: f + ' [exports]' });
  }
  Object.assign(ctx, ctx.__exports);
  return ctx;
}

export { ROOT };
