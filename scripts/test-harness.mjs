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
    'src/config/species.js',
    'src/utils/geo.js',
    'src/utils/truncation.js',
    'src/services/allometry.js',
    /* LULC ZİNCİRİ (Faz 5): index.html'deki sırayla. ui/lc-report facade'tan
     * ÖNCE yüklenmeli (facade dgLcRenderReport'u yükleme anında referanslar). */
    'src/services/lc-config.js',
    'src/services/lc-geo.js',
    'src/services/lc-stac.js',
    'src/services/lc-engine.js',
    'src/services/lc-osm.js',
    'src/services/lc-patches.js',
    'src/ui/lc-report.js',
    'src/services/landcover.js',
    /* PARK ZİNCİRİ (Faz 4): eski gridplan.js'in mantık modülleri, index.html'deki
     * yükleme sırasıyla. UI modülleri (src/ui/park-panel, src/ui/park-export)
     * BİLEREK yüklenmez — DOM'a yapışırlar; onları ui-audit statik tarar. */
    'src/services/park-state.js',
    'src/services/osm-client.js',
    'src/services/park-geometry.js',
    'src/services/park-query.js',
    'src/services/grid-engine.js',
  ];
  const dosyalar = sadece ? SIRALAMA.filter((f) => sadece.includes(f)) : SIRALAMA;

  const LEXICAL = ['SPECIES_DATA', 'GROUP_DEFAULT_RHO', 'species', 'rho', 'LATIN',
                   'GROUP_COLOR', 'QUOTA_MB', 'esc', '$',
                   'DG_LC_CODES', 'DG_LC_CLASSES', 'DG_LC_PIXEL_M', 'DG_LC_YEAR',
                   'DG_LC_COLLECTION', 'DG_LC_STAC', 'DG_LC_MAX_TILES',
                   'DG_LC_MAX_READ_PIXELS', 'DG_LC_RENDER_LIMIT',
                   'DG_LC_SOURCES', 'DG_ESA_GROUP', 'DG_ESA_CODES', 'DG_LC_SAS', 'DG_OSM_WATER_MIRRORS', 'DG_LC_LAYER', 'DG_LC_LAST',
                   'DG_TRUNCATION_WARNED'];
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
