import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import polygonClipping from 'polygon-clipping';

const modules=[
  'src/domain/surface/select-surface-review-features.js',
  'src/application/surface/prepare-surface-review-feature-masks.js',
  'src/application/surface/resolve-surface-review-cell.js',
  'src/application/surface/resolve-surface-review-parts.js',
  'src/domain/surface/summarize-surface-review-parts.js'
];
const dependencies=[
  'src/core/surface-display.js','src/services/lc-config.js','src/services/lc-geo.js','src/services/lc-validate.js','src/services/lc-s2.js',
  'src/contracts/surface-review.js','src/adapters/surface/review-store.js','src/domain/surface/review-geometry.js',
  'src/adapters/surface/osm-review-objects.js','src/adapters/surface/review-worker.js','src/application/surface/prepare-review.js','src/application/surface/merge-review-features.js'
];
function engine(modular){
  const ctx=vm.createContext({window:{polygonClipping},crypto:webcrypto,TextEncoder,URLSearchParams,Date,setTimeout,clearTimeout,console});
  for(const file of [...dependencies,...(modular?modules:[]),'src/services/lc-review.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  return{ctx,run:source=>vm.runInContext(source,ctx)};
}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
function fixture(app){
  const {ctx,run}=app,epsg=32631,xy=(x,y)=>{const point=run(`dgLcUtmInverse(${500000+x},${1000+y},${epsg})`);return[point.lon,point.lat];};
  const ring=(x0,y0,x1,y1)=>[xy(x0,y0),xy(x1,y0),xy(x1,y1),xy(x0,y1)],outer=ring(0,0,20,10).map(point=>[point[1],point[0]]);
  ctx.outer=outer;ctx.park=run('dgSurfacePark([outer],[],32631)');
  ctx.cells=[0,1].map(col=>({row:0,col,epsg,classKey:'green',areaM2:100,quadWgs:ring(col*10,0,(col+1)*10,10)}));
  ctx.geometries={};for(const cell of ctx.cells){ctx.c=cell;ctx.geometries['0:'+cell.col]=run('dgSurfaceCell(c,park,32631)');}
  ctx.features=[{type:'building',ring:ring(2,2,8,8)},{type:'pool',ring:ring(5,5,9,9)},{type:'unknown',ring:ring(0,0,1,1)}];
  return{ring};
}

test('five review-resolution modules preserve resolved geometry, area summaries, and cache behavior',()=>{
  const legacy=engine(false),modular=engine(true),legacyFixture=fixture(legacy),modularFixture=fixture(modular);
  for(const app of [legacy,modular]){
    app.ctx.classify=cell=>cell.classKey;
    app.ctx.parts=app.run('dgSurfaceResolved(cells,classify,geometries,features,32631,park)');
  }
  assert.equal(canonical(modular.ctx.parts),canonical(legacy.ctx.parts));
  for(const app of [legacy,modular])app.ctx.areas=app.run('dgSurfaceSummarize({green:200},cells,classify,geometries,features,32631,park)');
  assert.equal(canonical(modular.ctx.areas),canonical(legacy.ctx.areas));
  for(const app of [legacy,modular]){
    const clipping=app.ctx.window.polygonClipping.intersection;let calls=0;
    app.ctx.window.polygonClipping.intersection=(...args)=>{calls++;return clipping(...args);};
    app.ctx.classify=()=> 'hard';
    app.ctx.updated=app.run('dgSurfaceResolved(cells,classify,geometries,features,32631,park)');
    assert.equal(calls,0);
    assert.ok(app.ctx.updated.some(part=>part.type==='hard'));
    app.ctx.features.push({type:'water',ring:(app===legacy?legacyFixture:modularFixture).ring(10,2,12,4)});
    app.ctx.updated=app.run('dgSurfaceResolved(cells,classify,geometries,features,32631,park)');
    assert.ok(calls>0);
    assert.ok(app.ctx.updated.some(part=>part.type==='water'));
    app.ctx.window.polygonClipping.intersection=clipping;
  }
  assert.equal(canonical(modular.ctx.updated),canonical(legacy.ctx.updated));
});

test('review-resolution modules load before the service in lazy, worker, and offline precache paths',()=>{
  const lazy=readFileSync(new URL('../src/utils/lazylibs.js',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../src/workers/surface-worker.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of modules){
    assert.ok(lazy.indexOf('"'+file+'"')>=0&&lazy.indexOf('"'+file+'"')<lazy.indexOf('"src/services/lc-review.js"'));
    const workerPath=file.replace(/^src\//,'../');
    assert.ok(worker.indexOf("'"+workerPath+"'")>=0&&worker.indexOf("'"+workerPath+"'")<worker.indexOf("'../services/lc-review.js'"));
    assert.ok(sw.includes("'/"+file+"'"));
  }
});
