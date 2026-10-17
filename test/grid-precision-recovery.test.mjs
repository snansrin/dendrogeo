import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import polygonClipping from 'polygon-clipping';
import ClipperLib from 'clipper-lib';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function engine(){
 const context=vm.createContext({window:{polygonClipping},setTimeout,console});
 const files=[
  'src/services/lc-geo.js','src/contracts/surface-review.js','src/adapters/surface/review-store.js',
  'src/domain/surface/review-geometry.js','src/adapters/surface/osm-review-objects.js',
  'src/adapters/surface/review-worker.js','src/application/surface/prepare-review.js','src/application/surface/merge-review-features.js',
  'src/domain/surface/measure-grid-point-distance.js','src/domain/surface/find-grid-interior-point.js',
  'src/domain/surface/build-grid-line-mask.js','src/domain/surface/clean-grid-geometry.js','src/adapters/surface/clip-grid-geometry.js',
  'src/domain/surface/validate-surface-grid-options.js','src/application/surface/prepare-surface-grid-domain.js',
  'src/application/surface/erode-surface-grid-domain.js','src/application/surface/build-surface-sampling-grid-cells.js',
  'src/application/surface/run-surface-sampling-grid.js','src/services/lc-review.js'
 ];
 for(const path of files)vm.runInContext(read(path),context,{filename:path});
 return {context,run:source=>vm.runInContext(source,context)};
}

test('independent integer fallback keeps holes, nested islands and exclusions after both SweepLine attempts fail',()=>{
 const e=engine();
 e.context.window.ClipperLib=ClipperLib;
 vm.runInContext(read('src/adapters/surface/integer-grid-clip.js'),e.context);
 const rectangle=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
 const subject=[[rectangle(0,0,100,100),rectangle(20,20,40,40)],[rectangle(30,30,10,10)]],obstacle=[[rectangle(70,0,10,100)]];
 const before=JSON.stringify([subject,obstacle]);let failures=0;
 const clean=g=>e.context.window.DG_CLEAN_GRID_GEOMETRY.clean(g,{area:value=>e.run(`dgSurfaceArea(${JSON.stringify(value)})`)});
 const actual=e.context.window.DG_CLIP_GRID_GEOMETRY.clip('difference',[subject,obstacle],{clean,run:()=>{failures++;throw Error('Unable to find segment #117295 [218.064, 445.17399999999986] -> [218.06400000000005, 445.17399999999986] in SweepLine tree.');}});
 assert.equal(failures,2);
 const expected=polygonClipping.difference(subject,obstacle);
 assert.equal(e.run(`dgSurfaceArea(${JSON.stringify(actual)})`),e.run(`dgSurfaceArea(${JSON.stringify(expected)})`));
 for(const [point,inside] of [[[10,10],true],[[25,25],false],[[35,35],true],[[75,10],false],[[110,10],false]]){
  assert.equal(e.run(`dgGridPointDistance(${JSON.stringify(point)},${JSON.stringify(actual)})>0`),inside);
 }
 assert.equal(JSON.stringify([subject,obstacle]),before);
 for(const operation of ['union','intersection']){
  const result=e.context.window.DG_INTEGER_GRID_CLIP.clip(operation,[subject,obstacle],{library:ClipperLib});
  assert.equal(e.run(`dgSurfaceArea(${JSON.stringify(result)})`),e.run(`dgSurfaceArea(${JSON.stringify(polygonClipping[operation](subject,obstacle))})`));
 }
});

test('integer fallback supports empty operands and rejects unsafe coordinates or unsupported operations',()=>{
 const e=engine();vm.runInContext(read('src/adapters/surface/integer-grid-clip.js'),e.context);
 const clip=(op,geometries)=>e.context.window.DG_INTEGER_GRID_CLIP.clip(op,geometries,{library:ClipperLib}),rectangle=[[[[0,0],[10,0],[10,10],[0,10],[0,0]]]];
 assert.equal(JSON.stringify(clip('intersection',[rectangle,[]])),'[]');
 assert.equal(JSON.stringify(clip('difference',[[],rectangle])),'[]');
 assert.equal(JSON.stringify(clip('union',[])),'[]');
 assert.throws(()=>clip('bad',[rectangle]),/Unsupported/);
 assert.throws(()=>clip('union',[[[[[1e20,0],[1e20,5],[1e20+5,5],[1e20,0]]]]]),/safe integer/);
});

test('integer recovery remains private to one grid job and avoids repeated failed floating-point operations',()=>{
 const e=engine();e.context.window.ClipperLib=ClipperLib;vm.runInContext(read('src/adapters/surface/integer-grid-clip.js'),e.context);
 const geometry=[[[[0,0],[10,0],[10,10],[0,10],[0,0]]]],clean=g=>g;let attempts=0;
 const recovered=e.context.window.DG_CLIP_GRID_GEOMETRY.create({clean,run:()=>{attempts++;throw Error('Unable to find segment in SweepLine tree.');}});
 assert.ok(recovered('union',geometry).length);
 assert.ok(recovered('intersection',geometry,geometry).length);
 assert.equal(attempts,2,'later operations use the recovered job backend');
 let nextAttempts=0;
 const next=e.context.window.DG_CLIP_GRID_GEOMETRY.create({clean,run:(op,...g)=>{nextAttempts++;return polygonClipping[op](...g);}});
 assert.ok(next('union',geometry).length);assert.equal(nextAttempts,1,'a new grid retains the original successful backend');
});

test('bounded integer unions retain every raster piece across batch boundaries',()=>{
 const e=engine();vm.runInContext(read('src/adapters/surface/integer-grid-clip.js'),e.context);
 const pieces=Array.from({length:320},(_,i)=>{const x=i%20*10,y=Math.floor(i/20)*10;return[[[[x,y],[x+10,y],[x+10,y+10],[x,y+10],[x,y]]]];});
 const result=e.context.window.DG_INTEGER_GRID_CLIP.clip('union',pieces,{library:ClipperLib});
 assert.equal(e.run(`dgSurfaceArea(${JSON.stringify(result)})`),32000);
 const difference=e.context.window.DG_INTEGER_GRID_CLIP.clip('difference',[[[[[-10,-10],[210,-10],[210,170],[-10,170],[-10,-10]]]],...pieces],{library:ClipperLib});
 assert.equal(e.run(`dgSurfaceArea(${JSON.stringify(difference)})`),7600);
});

test('grid clipping recovers a SweepLine failure on the same millimetre lattice',()=>{
 const e=engine(),subject=[[[[767.554,246.344],[790.123,246.344],[790.123,270.987],[767.554,270.987],[767.554,246.344]]]],
  obstacle=[[[[780.111,240.001],[800.222,240.001],[800.222,260.555],[780.111,260.555],[780.111,240.001]]]],
  before=JSON.stringify([subject,obstacle]),calls=[];
 const clean=geometry=>e.context.window.DG_CLEAN_GRID_GEOMETRY.clean(geometry,{area:g=>e.run(`dgSurfaceArea(${JSON.stringify(g)})`)});
 const expected=clean(polygonClipping.difference(subject,obstacle));
 const result=e.context.window.DG_CLIP_GRID_GEOMETRY.clip('difference',[subject,obstacle],{clean,run:(operation,...values)=>{
  calls.push(values);
  if(calls.length===1)throw Error('Unable to find segment #137990 [767.5540000000018, 246.34400000000088] -> [767.911, 246.523] in SweepLine tree.');
  assert.equal(operation,'difference');
  assert.ok(values.flat(4).every(Number.isSafeInteger),'retry coordinates must be exact integer millimetres');
  return polygonClipping[operation](...values);
 }});
 assert.equal(calls.length,2);
 assert.equal(JSON.stringify(result),JSON.stringify(expected));
 assert.equal(JSON.stringify([subject,obstacle]),before);
 assert.ok(e.run(`dgSurfaceArea(${JSON.stringify(result)})`)<e.run(`dgSurfaceArea(${JSON.stringify(subject)})`),'exclusion was not dropped');
});

test('grid clipping preserves unrelated errors and never returns an uncut domain after recovery failure',()=>{
 const e=engine(),clip=e.context.window.DG_CLIP_GRID_GEOMETRY.clip,geometry=[[[[0,0],[10,0],[10,10],[0,10],[0,0]]]],clean=g=>g;
 const unrelated=Error('invalid geometry');let calls=0;
 assert.throws(()=>clip('intersection',[geometry,geometry],{clean,run:()=>{calls++;throw unrelated;}}),error=>error===unrelated);
 assert.equal(calls,1);
 calls=0;
 assert.throws(()=>clip('intersection',[geometry,geometry],{clean,run:()=>{calls++;throw Error('Unable to find segment in SweepLine tree.');}}),/SweepLine/);
 assert.equal(calls,2,'a failed retry must throw, never widen or empty the geometry');
});

for(const greenOnly of [false,true])test(`accepted Göksu surface builds a safe grid with green-only ${greenOnly}`,async()=>{
 const e=engine(),sample=JSON.parse(read('assets/landing/goksu-example.json')),before=JSON.stringify(sample);
 e.context.sample=sample;
 e.run(`input={size:20,clearance:3,epsg:sample.source.epsg,outer:sample.outer,holes:sample.holes,greenOnly:${greenOnly},
  parts:sample.features.map(f=>({type:f.properties.class,geom:f.geometry.coordinates.map(p=>p.map(r=>dgSurfaceProject(r,sample.source.epsg)))})),blockRings:[],blockLines:[]}`);
 const result=await e.run('dgSurfaceGrid(input)');
 assert.ok(result.cells.length>0);
 assert.equal(JSON.stringify(sample),before,'accepted source geometry remains unchanged');
 e.context.result=result;
 assert.equal(e.run(`result.cells.every(c=>{const p=dgLcUtmForward(c.lat,c.lon,input.epsg);return dgGridPointDistance([p.x,p.y],dgSurfacePark(input.outer,input.holes,input.epsg))>0&&input.parts.filter(s=>s.type!=='green').every(s=>dgGridPointDistance([p.x,p.y],s.geom)<0)})`),true,'waypoints remain inside the park and outside all excluded classes');
});
