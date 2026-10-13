import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import polygonClipping from 'polygon-clipping';

const modules=[
  'src/domain/surface/select-surface-review-fingerprint-fields.js',
  'src/domain/surface/serialize-surface-review-fingerprint-input.js',
  'src/adapters/surface/encode-surface-review-fingerprint-input.js',
  'src/adapters/surface/digest-surface-review-fingerprint.js',
  'src/application/surface/build-surface-review-fingerprint.js'
];
const dependencies=['src/services/lc-geo.js','src/contracts/surface-review.js','src/adapters/surface/review-store.js','src/domain/surface/review-geometry.js','src/adapters/surface/osm-review-objects.js','src/adapters/surface/review-worker.js','src/application/surface/prepare-review.js','src/application/surface/merge-review-features.js'];
function engine(modular){
  const ctx=vm.createContext({window:{polygonClipping},crypto:webcrypto,TextEncoder,setTimeout,console});
  for(const file of [...dependencies,...(modular?modules:[]),'src/services/lc-review.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  return{ctx,run:source=>vm.runInContext(source,ctx)};
}

test('five fingerprint modules preserve SHA-256 output, field selection and deterministic changes',async()=>{
  const legacy=engine(false),modular=engine(true),cells=[
    {row:2,col:3,epsg:32636,classKey:'green',areaM2:124.5,quadWgs:[[33,39],[33.1,39],[33.1,39.1],[33,39.1]]},
    {row:2,col:4,epsg:32636,classKey:'water',areaM2:8,quadWgs:[[33.1,39],[33.2,39],[33.2,39.1],[33.1,39.1]]}
  ],outer=[[[39,33],[39,33.2],[39.1,33.2]]],holes=[[[39.03,33.03],[39.04,33.03],[39.04,33.04]]],meta={year:2026,source:'sentinel-2'};
  for(const app of [legacy,modular]){app.ctx.cells=cells;app.ctx.outer=outer;app.ctx.holes=holes;app.ctx.meta=meta;}
  const expected=await legacy.run('window.DG_SURFACE_REVIEW.fingerprint(cells,outer,holes,meta)'),actual=await modular.run('window.DG_SURFACE_REVIEW.fingerprint(cells,outer,holes,meta)');
  assert.equal(actual,expected);assert.match(actual,/^[a-f0-9]{64}$/);
  for(const app of [legacy,modular])app.ctx.changed=cells.map(cell=>({...cell}));
  legacy.ctx.changed[0].classKey='hard';modular.ctx.changed[0].classKey='hard';
  const legacyChanged=await legacy.run('window.DG_SURFACE_REVIEW.fingerprint(changed,outer,holes,meta)'),modularChanged=await modular.run('window.DG_SURFACE_REVIEW.fingerprint(changed,outer,holes,meta)');
  assert.equal(modularChanged,legacyChanged);assert.notEqual(modularChanged,actual);
});

test('fingerprint modules load before lc-review in lazy, worker and offline paths',()=>{
  const lazy=readFileSync(new URL('../src/utils/lazylibs.js',import.meta.url),'utf8'),worker=readFileSync(new URL('../src/workers/surface-worker.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of modules){
    const lazyIndex=lazy.indexOf('"'+file+'"'),lazyService=lazy.indexOf('"src/services/lc-review.js"');assert.ok(lazyIndex>=0&&lazyIndex<lazyService,file);
    const workerPath=file.replace(/^src\//,'../'),workerIndex=worker.indexOf("'"+workerPath+"'"),workerService=worker.indexOf("'../services/lc-review.js'");assert.ok(workerIndex>=0&&workerIndex<workerService,file);
    assert.ok(sw.includes("'/"+file+"'"),file);
  }
});
