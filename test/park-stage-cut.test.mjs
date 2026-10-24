import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import polygon from 'polygon-clipping';
const ctx=vm.createContext({window:{}});
for(const file of ['src/domain/parks/stage-geometry.js','src/domain/parks/stage-cut-geometry.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
const api=ctx.window.DG_PARK_STAGE_CUT_GEOMETRY,ports={polygon,clip:ctx.window.DG_PARK_STAGE_GEOMETRY.clip};
const rect=(a,b,h,w)=>[[a,b],[a,b+w],[a+h,b+w],[a+h,b],[a,b]],flip=r=>r.map(p=>[p[1],p[0]]);
function mp(g){let result=polygon.union(...g.outer.map(r=>[flip(r)]));return g.inner.length?polygon.difference(result,...g.inner.map(r=>[flip(r)])):result;}
function area(polys){return polys.reduce((s,p)=>s+p.reduce((sum,r,i)=>sum+(i?-1:1)*Math.abs(r.slice(0,-1).reduce((v,a,j)=>v+a[0]*r[j+1][1]-r[j+1][0]*a[1],0)/2),0),0);}
const parent={outer:[rect(39,32,.006,.002)],inner:[rect(39.002,32.0005,.001,.0005)]};
test('Two taps cut the existing park between planes, preserving outer boundary and holes',()=>{
 const before=JSON.stringify(parent),result=api.between(parent,[[39.001,32.001],[39.004,32.001]],ports);
 assert.equal(result.geometry.outer.length,1);assert.equal(result.geometry.inner.length,1);assert.equal(result.lines.length,2);
 for(const p of result.geometry.outer.flat())assert.ok(p[0]>=39.001-1e-10&&p[0]<=39.004+1e-10&&p[1]>=32-1e-10&&p[1]<=32.002+1e-10);
 assert.ok(area(polygon.difference(mp(result.geometry),mp(parent)))<1e-10);assert.equal(JSON.stringify(parent),before);
});
test('Reversing start/end gives the same selected park area',()=>{
 const a=api.between(parent,[[39.001,32.001],[39.004,32.001]],ports),b=api.between(parent,[[39.004,32.001],[39.001,32.001]],ports);
 assert.ok(area(polygon.xor(mp(a.geometry),mp(b.geometry)))<1e-10);
});
test('Automatic 2/3/4 proposals partition the real park without overlaps, bridges or missing area',()=>{
 for(const count of [2,3,4]){
  const results=api.suggest(parent,count,ports);assert.equal(results.length,count);
  const geometries=results.map(r=>mp(r.geometry));assert.ok(area(polygon.xor(polygon.union(...geometries),mp(parent)))<1e-10);
  for(let i=0;i<count;i++)for(let j=i+1;j<count;j++)assert.ok(area(polygon.intersection(geometries[i],geometries[j]))<1e-10);
  assert.ok(results.every(r=>r.method==='axis-proposal'));
 }
});
test('Separate park components are detected as geometry parts, without invented official stage names',()=>{
 const g={outer:[rect(39,32,.002,.001),rect(39.004,32,.002,.001)],inner:[]};
 const parts=api.suggest(g,3,ports);assert.equal(parts.length,2);assert.ok(parts.every(r=>r.method==='separate-component'));
 assert.ok(area(polygon.xor(polygon.union(...parts.map(r=>mp(r.geometry))),mp(g)))<1e-10);
});
test('Concave park is clipped rather than replaced by the rectangular selection mask',()=>{
 const g={outer:[[[39,32],[39,32.004],[39.001,32.004],[39.001,32.001],[39.005,32.001],[39.005,32],[39,32]]],inner:[]};
 const result=api.between(g,[[39.0005,32],[39.004,32]],ports);
 assert.ok(area(polygon.difference(mp(result.geometry),mp(g)))<1e-10);
});
test('Missing, invalid, coincident points and unsupported counts fail without producing a scope',()=>{
 for(const points of [[],[[39,32]],[[39,32],[39,32]],[[39,32],[100,32]]])assert.throws(()=>api.between(parent,points,ports));
 assert.throws(()=>api.suggest(parent,5,ports));assert.throws(()=>api.between(parent,[[1,1],[1.001,1]],ports),/kesişmiyor/);
});
test('Real Dikmen boundary: 318-node single park partitions without area loss or exceeding stage storage limits',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/park-stages/dikmen-boundary.json',import.meta.url))),g=fixture.geometry;
 assert.equal(fixture.osmKey,'relation/14290362');assert.equal(g.outer.length,1);assert.equal(g.outer[0].length,318);
 for(const count of [2,3,4]){
  const sections=api.suggest(g,count,ports);assert.equal(sections.length,count);
  assert.ok(area(polygon.xor(polygon.union(...sections.map(s=>mp(s.geometry))),mp(g)))<1e-10);
  assert.ok(sections.every(s=>s.geometry.outer.every(r=>r.length<=301)),'default proposals must fit the existing stage guard');
 }
});
test('Real Dikmen two-point strip keeps the original irregular boundary, without a hull or bounding-box replacement',()=>{
 const {geometry:g}=JSON.parse(readFileSync(new URL('./fixtures/park-stages/dikmen-boundary.json',import.meta.url)));
 const points=g.outer.flat(),min=Math.min(...points.map(p=>p[0])),max=Math.max(...points.map(p=>p[0])),lon=points.reduce((n,p)=>n+p[1],0)/points.length;
 const selected=api.between(g,[[min+(max-min)*.2,lon],[min+(max-min)*.8,lon]],ports);
 assert.ok(area(mp(selected.geometry))>0);assert.ok(area(mp(selected.geometry))<area(mp(g)));
 assert.ok(area(polygon.difference(mp(selected.geometry),mp(g)))<1e-10);
 assert.ok(selected.geometry.outer.every(r=>r.length<=301));
});
