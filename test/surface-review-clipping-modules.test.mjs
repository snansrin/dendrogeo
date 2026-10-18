import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import polygonClipping from 'polygon-clipping';
import clipperLib from 'clipper-lib';

const modules=[
  'src/domain/surface/collect-surface-review-clip-points.js',
  'src/domain/surface/find-surface-review-clip-origin.js',
  'src/domain/surface/translate-surface-review-geometry.js',
  'src/adapters/surface/run-surface-review-polygon-operation.js',
  'src/application/surface/clip-surface-review-geometry.js',
  'src/adapters/surface/integer-grid-clip.js'
];
const dependencies=['src/services/lc-geo.js','src/contracts/surface-review.js','src/adapters/surface/review-store.js','src/domain/surface/review-geometry.js','src/adapters/surface/osm-review-objects.js','src/adapters/surface/review-worker.js','src/application/surface/prepare-review.js','src/application/surface/merge-review-features.js'];
function engine(modular){
  const ctx=vm.createContext({window:{polygonClipping,ClipperLib:clipperLib},ClipperLib:clipperLib,setTimeout,console});
  for(const file of [...dependencies,...(modular?modules:[]),'src/services/lc-review.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  return{ctx,run:source=>vm.runInContext(source,ctx)};
}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

test('surface clipping modules preserve polygon output, local frame restoration and failure behavior',()=>{
  const legacy=engine(false),modular=engine(true);
  const outer=[[[500000,4420000],[500080,4420000],[500080,4420060],[500000,4420060],[500000,4420000]]];
  const hole=[[[500020,4420020],[500040,4420020],[500040,4420040],[500020,4420040],[500020,4420020]]];
  for(const app of [legacy,modular]){
    app.ctx.outer=outer;app.ctx.hole=hole;
    for(const operation of ['union','difference','intersection']){
      app.ctx.op=operation;
      if(operation==='union')app.ctx.result=app.run('dgSurfaceClip(op,[outer])');
      else app.ctx.result=app.run('dgSurfaceClip(op,[outer],[hole])');
      app.ctx['result_'+operation]=app.ctx.result;
    }
    app.ctx.empty=app.run('dgSurfaceClip("union")');
    app.ctx.missing=app.run('(()=>{try{dgSurfaceClip("missing",[outer]);return "no error";}catch(error){return error.message;}})()');
    const clipping=app.ctx.window.polygonClipping.intersection;
    app.ctx.window.polygonClipping.intersection=()=>{throw Error('Unable to find segment');};
    app.ctx.numeric=app.run('(()=>{try{dgSurfaceClip("intersection",[outer],[hole]);return "no error";}catch(error){return error.message;}})()');
    app.ctx.window.polygonClipping.intersection=clipping;
  }
  for(const operation of ['union','difference','intersection'])assert.equal(canonical(modular.ctx['result_'+operation]),canonical(legacy.ctx['result_'+operation]),operation);
  for(const key of ['empty','missing'])assert.equal(key==='empty'?canonical(modular.ctx[key]):modular.ctx[key],key==='empty'?canonical(legacy.ctx[key]):legacy.ctx[key],key);
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.ctx.empty)),[]);
  assert.match(legacy.ctx.numeric,/sayısal olarak kararsız/);
  assert.equal(modular.ctx.numeric,'no error');
});

test('surface review retries a known sweep-line failure on the existing millimetre lattice',()=>{
  const app=engine(true);
  const outer=[[[500000,4420000],[500080,4420000],[500080,4420060],[500000,4420060],[500000,4420000]]];
  const inner=[[[500020,4420020],[500040,4420020],[500040,4420040],[500020,4420040],[500020,4420020]]];
  app.ctx.outer=outer;app.ctx.inner=inner;
  app.ctx.window.polygonClipping.intersection=()=>{throw Error('Unable to find segment in SweepLine tree');};
  app.ctx.result=app.run(`window.DG_CLIP_SURFACE_REVIEW_GEOMETRY.clip('intersection',[[outer],[inner]],{
    clean:value=>value,
    collectPoints:window.DG_COLLECT_SURFACE_REVIEW_CLIP_POINTS.collect,
    findOrigin:window.DG_FIND_SURFACE_REVIEW_CLIP_ORIGIN.find,
    translate:window.DG_TRANSLATE_SURFACE_REVIEW_GEOMETRY.translate,
    clipper:window.DG_RUN_SURFACE_REVIEW_POLYGON_OPERATION,
    integerClip:(operation,local)=>window.DG_INTEGER_GRID_CLIP.clip(operation,local,{library:window.ClipperLib})
  })`);
  const result=JSON.parse(JSON.stringify(app.ctx.result));
  assert.equal(result.length,1);
  assert.equal(result[0].length,1);
  assert.ok(Math.abs(Math.abs(result[0][0].reduce((sum,p,index,ring)=>{
    const q=ring[(index+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];
  },0)/2)-400)<0.001);
});

test('clipping modules load before lc-review in lazy, worker and offline paths',()=>{
  const lazy=readFileSync(new URL('../src/utils/lazylibs.js',import.meta.url),'utf8'),worker=readFileSync(new URL('../src/workers/surface-worker.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of modules){
    const lazyIndex=lazy.indexOf('"'+file+'"'),lazyService=lazy.indexOf('"src/services/lc-review.js"');assert.ok(lazyIndex>=0&&lazyIndex<lazyService,file);
    const workerPath=file.replace(/^src\//,'../'),workerIndex=worker.indexOf("'"+workerPath+"'"),workerService=worker.indexOf("'../services/lc-review.js'");assert.ok(workerIndex>=0&&workerIndex<workerService,file);
    assert.ok(sw.includes("'/"+file+"'"),file);
  }
});
