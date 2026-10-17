import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import polygonClipping from 'polygon-clipping';

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
