import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import pc from 'polygon-clipping';

const geometryModules=[
  'src/domain/surface/measure-grid-point-distance.js',
  'src/domain/surface/find-grid-interior-point.js',
  'src/domain/surface/build-grid-line-mask.js',
  'src/domain/surface/clean-grid-geometry.js',
  'src/adapters/surface/clip-grid-geometry.js'
];
const workflowModules=[
  'src/domain/surface/validate-surface-grid-options.js',
  'src/application/surface/prepare-surface-grid-domain.js',
  'src/application/surface/erode-surface-grid-domain.js',
  'src/application/surface/build-surface-sampling-grid-cells.js',
  'src/application/surface/run-surface-sampling-grid.js'
];
const serviceDependencies=[
  'src/services/lc-geo.js','src/contracts/surface-review.js','src/adapters/surface/review-store.js',
  'src/domain/surface/review-geometry.js','src/adapters/surface/osm-review-objects.js',
  'src/adapters/surface/review-worker.js','src/application/surface/prepare-review.js',
  'src/application/surface/merge-review-features.js'
];
function engine(modular){
  const ctx=vm.createContext({window:{polygonClipping:pc},setTimeout,console});
  const files=[...serviceDependencies,...(modular?[...geometryModules,...workflowModules]:[]),'src/services/lc-review.js'];
  for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  return{ctx,run:source=>vm.runInContext(source,ctx)};
}
const origin=[500000,4420000];
const rect=(x,y,w,h)=>[[[origin[0]+x,origin[1]+y],[origin[0]+x+w,origin[1]+y],[origin[0]+x+w,origin[1]+y+h],[origin[0]+x,origin[1]+y+h],[origin[0]+x,origin[1]+y]]];
function input(engine,green,park=rect(0,0,80,60),clearance=3){
  engine.ctx.park=park;
  const outer=engine.run('dgSurfaceUnproject([park],32636)[0].map(r=>r.map(p=>[p[1],p[0]]))');
  return{size:20,clearance,epsg:32636,outer,holes:[],greenOnly:true,parts:[{type:'green',geom:green}],blockRings:[],blockLines:[]};
}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

test('five grid workflow modules preserve locked service output and errors',async()=>{
  const legacy=engine(false),modular=engine(true),park=rect(0,0,73,57);
  const green=pc.difference([park],[rect(28,0,8,57)],[rect(48,18,15,17)]);
  const scenarios=[[green,park,3],[[rect(1,1,8,18),rect(11,1,8,18)],rect(0,0,20,20),1]];
  for(const [areas,parkGeometry,clearance] of scenarios){
    legacy.ctx.data=input(legacy,areas,parkGeometry,clearance);
    modular.ctx.data=input(modular,areas,parkGeometry,clearance);
    const expected=await legacy.run('dgSurfaceGrid(data)'),actual=await modular.run('dgSurfaceGrid(data)');
    if(canonical(actual)!==canonical(expected)){
      const keys=Object.keys(expected).filter(key=>canonical(actual[key])!==canonical(expected[key]));
      const cellIndex=expected.cells.findIndex((cell,index)=>canonical(actual.cells[index])!==canonical(cell));
      const cellKeys=cellIndex<0?[]:Object.keys(expected.cells[cellIndex]).filter(key=>canonical(actual.cells[cellIndex][key])!==canonical(expected.cells[cellIndex][key]));
      assert.fail(`output mismatch: ${keys.join(',')}; cell ${cellIndex}: ${cellKeys.map(key=>`${key} expected=${canonical(expected.cells[cellIndex][key])} actual=${canonical(actual.cells[cellIndex][key])}`).join('; ')}`);
    }
  }
  const invalidLegacy=input(legacy,green,park),invalidModular=input(modular,green,park);
  invalidLegacy.size=invalidModular.size=15;
  legacy.ctx.data=invalidLegacy;modular.ctx.data=invalidModular;
  await assert.rejects(()=>legacy.run('dgSurfaceGrid(data)'),/Grid boyutu veya güvenlik mesafesi geçersiz/);
  await assert.rejects(()=>modular.run('dgSurfaceGrid(data)'),/Grid boyutu veya güvenlik mesafesi geçersiz/);
  legacy.ctx.data=input(legacy,[],park);modular.ctx.data=input(modular,[],park);
  await assert.rejects(()=>legacy.run('dgSurfaceGrid(data)'),/Yeşil alan bulunamadı/);
  await assert.rejects(()=>modular.run('dgSurfaceGrid(data)'),/Yeşil alan bulunamadı/);
});

test('workflow modules load before lc-review in both lazy page and worker entry points',()=>{
  const lazy=readFileSync(new URL('../src/utils/lazylibs.js',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../src/workers/surface-worker.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of workflowModules){
    const lazyIndex=lazy.indexOf('"'+file+'"'),lazyService=lazy.indexOf('"src/services/lc-review.js"');
    assert.ok(lazyIndex>=0&&lazyIndex<lazyService,`${file} must precede the service in lazy loading`);
    const workerPath=file.replace(/^src\//,'../');
    const workerIndex=worker.indexOf("'"+workerPath+"'"),workerService=worker.indexOf("'../services/lc-review.js'");
    assert.ok(workerIndex>=0&&workerIndex<workerService,`${file} must precede the service in worker loading`);
    assert.ok(sw.includes("'/"+file+"'"),`${file} must be precached`);
  }
});
