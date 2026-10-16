import vm from 'node:vm';
import {surfaceRuntimeModules} from './surface-runtime-modules.mjs';

/* Build the isolated browser-like runtime used by immutable report land-cover
 * analysis. Application source and classification remain the single source of
 * truth; this loader only wires the existing runtime dependencies. */
const MODS = [
  'src/utils/geo.js', 'src/application/parks/grid-session-state.js', 'src/services/park-state.js',
  'src/domain/parks/area.js', 'src/domain/parks/segment-intersection.js',
  'src/domain/parks/point-in-polygon.js', 'src/domain/parks/bounds.js',
  'src/domain/parks/park-containment.js', 'src/domain/parks/line-distance.js',
  'src/domain/parks/osm-rings.js', 'src/domain/parks/rect-intersection.js',
  'src/domain/parks/cell-in-park.js', 'src/domain/parks/park-overlap.js',
  'src/services/park-geometry.js'
];

export function createReportLandcoverRuntime({read}) {
  return function bootLC() {
    const ctx = {
      console: { log() {}, warn() {}, error() {} },
      fetch: (u, o) => fetch(u, Object.assign({ headers: { 'User-Agent': 'dendrogeo-rapor/1.0' } }, o)),
      URL, URLSearchParams, TextEncoder, TextDecoder, AbortController,
      Math, JSON, Date, Promise, Number, Array, Object, String, Boolean, RegExp, Error, Map, Set,
      setTimeout, clearTimeout, parseInt, parseFloat, isNaN, Intl,
      ArrayBuffer, Uint8Array, Uint16Array, Int32Array, Float32Array, Float64Array, DataView,
      Response, Headers, Request, Buffer,
      document: { createElement: () => ({}) }, navigator: { userAgent: 'rapor' }, location: { origin: 'https://rapor.local' },
      Worker: class { postMessage() { throw new Error('worker yolu beklenmiyor'); } terminate() {} addEventListener() {} removeEventListener() {} },
    };
    ctx.window = ctx; ctx.self = ctx;
    if (!ctx.URL.createObjectURL) ctx.URL.createObjectURL = () => 'blob:rapor';
    vm.createContext(ctx);
    vm.runInContext(read('vendor/geotiff-2.1.3.js'), ctx, { filename: 'geotiff' });
    for (const m of [...MODS,...surfaceRuntimeModules(read)]) vm.runInContext(read(m), ctx, { filename: m });
    vm.runInContext('globalThis.__dgLast=function(){return typeof DG_LC_LAST!=="undefined"?DG_LC_LAST:null;};', ctx);
    return ctx;
  };
}
