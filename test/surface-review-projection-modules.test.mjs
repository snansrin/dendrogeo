import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import polygonClipping from 'polygon-clipping';

const modules=[
  'src/domain/surface/snap-surface-review-coordinate.js',
  'src/adapters/surface/project-surface-review-ring.js',
  'src/adapters/surface/unproject-surface-review-geometry.js',
  'src/application/surface/build-surface-review-park-geometry.js',
  'src/application/surface/build-surface-review-cell-geometry.js'
];
const dependencies=['src/services/lc-geo.js','src/contracts/surface-review.js','src/adapters/surface/review-store.js','src/domain/surface/review-geometry.js','src/adapters/surface/osm-review-objects.js','src/adapters/surface/review-worker.js','src/application/surface/prepare-review.js','src/application/surface/merge-review-features.js'];
function engine(modular){
  const ctx=vm.createContext({window:{polygonClipping},setTimeout,console});
  for(const file of [...dependencies,...(modular?modules:[]),'src/services/lc-review.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  return{ctx,run:source=>vm.runInContext(source,ctx)};
}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

test('five projection and park-geometry modules preserve service coordinates, holes and cache identity',()=>{
  const legacy=engine(false),modular=engine(true);
  for(const app of [legacy,modular]){
    app.ctx.points=[[33,39.93],[33.0001,39.93],[33.0001,39.9301],[33,39.9301]];
    app.ctx.hole=[[33.00003,39.93003],[33.00006,39.93003],[33.00006,39.93006],[33.00003,39.93006]];
    app.ctx.outer=app.run('points.map(([lon,lat])=>[lat,lon])');
    app.ctx.holes=app.run('hole.map(([lon,lat])=>[lat,lon])');
    app.ctx.park=app.run('dgSurfacePark([outer],[holes],32636)');
    app.ctx.ring=app.run('dgSurfaceProject(points,32636)');
    app.ctx.wgs=app.run('dgSurfaceUnproject(park,32636)');
    app.ctx.cell={quadWgs:[[33.00001,39.93001],[33.00008,39.93001],[33.00008,39.93008],[33.00001,39.93008]]};
    app.ctx.cellGeometry=app.run('dgSurfaceCell(cell,park,32636)');
  }
  for(const key of ['ring','park','wgs','cellGeometry'])assert.equal(canonical(modular.ctx[key]),canonical(legacy.ctx[key]),key);
  for(const app of [legacy,modular]){
    app.ctx.first=app.run('dgSurfaceUnproject(park,32636)');
    app.ctx.second=app.run('dgSurfaceUnproject(park,32636)');
    assert.equal(app.ctx.first,app.ctx.second);
  }
  assert.ok(legacy.run('dgSurfaceArea(park)')>0);
  assert.equal(canonical(modular.run('dgSurfaceArea(park)')),canonical(legacy.run('dgSurfaceArea(park)')));
});

test('projection and park modules load before lc-review in lazy, worker and offline paths',()=>{
  const lazy=readFileSync(new URL('../src/utils/lazylibs.js',import.meta.url),'utf8'),worker=readFileSync(new URL('../src/workers/surface-worker.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of modules){
    const lazyIndex=lazy.indexOf('"'+file+'"'),lazyService=lazy.indexOf('"src/services/lc-review.js"');
    assert.ok(lazyIndex>=0&&lazyIndex<lazyService,file);
    const workerPath=file.replace(/^src\//,'../'),workerIndex=worker.indexOf("'"+workerPath+"'"),workerService=worker.indexOf("'../services/lc-review.js'");
    assert.ok(workerIndex>=0&&workerIndex<workerService,file);
    assert.ok(sw.includes("'/"+file+"'"),file);
  }
});
