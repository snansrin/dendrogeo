import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';import polygon from'polygon-clipping';
const ctx=vm.createContext({window:{}});for(const file of ['src/domain/parks/stage-geometry.js','src/domain/parks/stage-curved-boundaries.js','src/domain/parks/stage-boundary-paths.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
const api=ctx.window.DG_PARK_STAGE_BOUNDARY_PATHS,ports={polygon,clip:ctx.window.DG_PARK_STAGE_GEOMETRY.clip},rect=(a,b,h,w)=>[[a,b],[a,b+w],[a+h,b+w],[a+h,b],[a,b]],parent={outer:[rect(39,32,.01,.01)],inner:[rect(39.005,32.004,.001,.001)]};
const paths=[[[39.008,32],[39.008,32.01]],[[39.003,32],[39.004,32.003],[39.003,32.002],[39.002,32.005],[39.004,32.007],[39.003,32.01]]];
const mp=g=>{const flip=r=>r.map(p=>[p[1],p[0]]);let p=polygon.union(...g.outer.map(r=>[flip(r)]));return g.inner.length?polygon.difference(p,...g.inner.map(r=>[flip(r)])):p;};
const area=polys=>polys.reduce((n,part)=>n+part.reduce((s,r)=>s+Math.abs(r.slice(1).reduce((a,p,i)=>a+p[0]*r[i][1]-r[i][0]*p[1],0)/2),0),0);
test('A simple S-shaped cap may turn back in projected direction and remains editable',()=>{
 const before=JSON.stringify({parent,paths}),result=api.between(parent,paths,ports);assert.equal(result.method,'curved-boundaries');assert.equal(result.geometry.inner.length,1);assert.equal(JSON.stringify({parent,paths}),before);
 assert.ok(area(polygon.difference(mp(result.geometry),mp(parent)))<1e-12);for(const p of paths.flat())assert.ok(result.geometry.outer.flat().some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-9));
 const reverse=api.between(parent,paths.map(line=>[...line].reverse()),ports);assert.ok(area(polygon.xor(mp(result.geometry),mp(reverse.geometry)))<1e-12);
});
test('True self crossings and coincident controls are still rejected',()=>{
 assert.throws(()=>api.between(parent,[paths[0],[[39.003,32],[39.006,32.007],[39.002,32.007],[39.007,32]]],ports),/kendi üzerinden|kesiş/);
 assert.throws(()=>api.between(parent,[paths[0],[[39.003,32],[39.003,32],[39.003,32.01]]],ports),/üst üste|Aynı yere/);
});
test('Detailed sub-metre controls do not inherit the old two-anchor 2 m restriction',()=>{
 const dense=[[[39.008,32],[39.008,32.000005],[39.008,32.01]],[[39.003,32],[39.003,32.01]]];const result=api.between(parent,dense,ports);assert.ok(result.geometry.outer.length);assert.ok(area(polygon.difference(mp(result.geometry),mp(parent)))<1e-12);
});
