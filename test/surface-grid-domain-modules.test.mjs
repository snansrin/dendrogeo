import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import polygonClipping from 'polygon-clipping';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/surface/measure-grid-point-distance.js',
  'src/domain/surface/find-grid-interior-point.js',
  'src/domain/surface/build-grid-line-mask.js',
  'src/domain/surface/clean-grid-geometry.js',
  'src/adapters/surface/clip-grid-geometry.js'
];
function engine(withModules){
  const ctx=vm.createContext({window:{polygonClipping},setTimeout,console});
  const files=['src/services/lc-geo.js','src/contracts/surface-review.js','src/adapters/surface/review-store.js','src/domain/surface/review-geometry.js','src/adapters/surface/osm-review-objects.js','src/adapters/surface/review-worker.js','src/application/surface/prepare-review.js','src/application/surface/merge-review-features.js',...(withModules?modules:[]),'src/services/lc-review.js'];
  for(const path of files)vm.runInContext(read(path),ctx,{filename:path});
  return{ctx,run:source=>vm.runInContext(source,ctx)};
}
const same=(actual,expected)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected));
const origin=[500000,4420000],rect=(x,y,w,h)=>[[[origin[0]+x,origin[1]+y],[origin[0]+x+w,origin[1]+y],[origin[0]+x+w,origin[1]+y+h],[origin[0]+x,origin[1]+y+h],[origin[0]+x,origin[1]+y]]];

test('five grid geometry modules preserve signed distance, interior points, masks, precision and cells',async()=>{
  const fallback=engine(false),modular=engine(true);
  const polygon=rect(0,0,30,24),withHole=[polygon[0],rect(10,8,5,6)[0].slice().reverse()];
  for(const point of [[origin[0]+2,origin[1]+3],[origin[0]+12,origin[1]+10],[origin[0]+40,origin[1]+10]])same(modular.run(`dgGridPointDistance(${JSON.stringify(point)},${JSON.stringify([withHole])})`),fallback.run(`dgGridPointDistance(${JSON.stringify(point)},${JSON.stringify([withHole])})`));
  same(modular.run(`dgGridInterior(${JSON.stringify(polygon)})`),fallback.run(`dgGridInterior(${JSON.stringify(polygon)})`));
  const line=[[origin[0]+2,origin[1]+4],[origin[0]+22,origin[1]+14]],geographic=fallback.run(`(${JSON.stringify(line)}).map(([x,y])=>{const p=dgLcUtmInverse(x,y,32636);return[p.lat,p.lon]})`),feature={pts:geographic,w:2};
  same(modular.run(`dgGridLineMask(${JSON.stringify(feature)},32636)`),fallback.run(`dgGridLineMask(${JSON.stringify(feature)},32636)`));
  same(modular.run(`dgSurfaceClean(${JSON.stringify([withHole])})`),fallback.run(`dgSurfaceClean(${JSON.stringify([withHole])})`));
  same(modular.run(`dgGridPrecisionClip('intersection',${JSON.stringify([polygon])},${JSON.stringify([rect(5,5,15,15)])})`),fallback.run(`dgGridPrecisionClip('intersection',${JSON.stringify([polygon])},${JSON.stringify([rect(5,5,15,15)])})`));
  const d={size:20,clearance:3,epsg:32636,outer:fallback.run(`dgSurfaceUnproject(${JSON.stringify([polygon])},32636)[0].map(r=>r.map(p=>[p[1],p[0]]))`),holes:[],greenOnly:true,parts:[{type:'green',geom:[polygon]}],blockRings:[],blockLines:[]};
  fallback.ctx.d=d;modular.ctx.d=d;
  same(await modular.run('dgSurfaceGrid(d)'),await fallback.run('dgSurfaceGrid(d)'));
});

test('grid modules precede the service in lazy loading, worker imports and offline precache',()=>{
  const loader=read('src/utils/lazylibs.js'),worker=read('src/workers/surface-worker.js'),sw=read('sw.js'),service='src/services/lc-review.js',serviceIndex=loader.indexOf('"'+service+'"');
  for(const path of modules){
    assert.ok(loader.indexOf('"'+path+'"')>=0&&loader.indexOf('"'+path+'"')<serviceIndex,path+' lazy order');
    assert.ok(worker.includes("'../"+path.replace(/^src\//,'')),path+' worker import');
    assert.ok(sw.includes("'/"+path+"'"),path+' precache');
  }
});
