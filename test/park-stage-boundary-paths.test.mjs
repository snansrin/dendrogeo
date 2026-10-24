import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';import polygon from'polygon-clipping';
const ctx=vm.createContext({window:{}});for(const file of ['src/domain/parks/stage-geometry.js','src/domain/parks/stage-cut-geometry.js','src/domain/parks/stage-boundary-paths.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
const api=ctx.window.DG_PARK_STAGE_BOUNDARY_PATHS,ports={polygon,clip:ctx.window.DG_PARK_STAGE_GEOMETRY.clip};
const rect=(a,b,h,w)=>[[a,b],[a,b+w],[a+h,b+w],[a+h,b],[a,b]],parent={outer:[rect(39,32,.01,.02)],inner:[rect(39.004,32.008,.001,.002)]};
const cuts=[[[39.002,32],[39.003,32.005],[39.002,32.01],[39.0025,32.02]],[[39.008,32],[39.007,32.01],[39.008,32.02]]];
const mp=g=>{const flip=r=>r.map(p=>[p[1],p[0]]);let m=polygon.union(...g.outer.map(r=>[flip(r)]));return g.inner.length?polygon.difference(m,...g.inner.map(r=>[flip(r)])):m;};
test('Detailed cut paths preserve bends, parent sides and holes, without editing any inputs',()=>{
 const before=JSON.stringify({parent,cuts}),result=api.between(parent,cuts,ports);
 assert.equal(result.method,'boundary-paths');assert.equal(result.geometry.inner.length,1);assert.equal(result.lines[0].length,6);
 assert.deepEqual(polygon.difference(mp(result.geometry),mp(parent)),[]);assert.equal(JSON.stringify({parent,cuts}),before);
 for(const p of cuts.flat())assert.ok(result.geometry.outer.flat().some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-10),'the curve control point is retained');
 for(const p of result.geometry.outer.flat())assert.ok(p[1]>=32-1e-10&&p[1]<=32.02+1e-10);
 const reverse=api.between(parent,cuts.map(line=>[...line].reverse()).reverse(),ports);assert.deepEqual(polygon.xor(mp(result.geometry),mp(reverse.geometry)),[]);
});
test('Two-point detail paths agree with the existing independent cut contract',()=>{
 const lines=cuts.map(line=>[line[0],line.at(-1)]),old=ctx.window.DG_PARK_STAGE_CUT_GEOMETRY.betweenCuts(parent,lines,ports),result=api.between(parent,lines,ports);
 const difference=polygon.xor(mp(result.geometry),mp(old.geometry)),area=difference.reduce((n,part)=>n+part.reduce((s,ring)=>s+Math.abs(ring.slice(1).reduce((a,p,i)=>a+p[0]*ring[i][1]-ring[i][0]*p[1],0)/2),0),0);assert.ok(area<1e-12);
 for(const point of result.geometry.outer.flat())assert.ok(old.geometry.outer.flat().some(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<1e-10));
});
test('Recover only stage cap paths; parent perimeter and parent hole edges never become draggable handles',()=>{
 const result=api.between(parent,cuts,ports),recovered=api.recover(parent,result.geometry);assert.equal(recovered.length,2);
 assert.equal(recovered.map(p=>p.length).sort().join(','),'3,4');const rebuilt=api.between(parent,recovered,ports);
 assert.deepEqual(polygon.xor(mp(rebuilt.geometry),mp(result.geometry)),[]);assert.equal(api.recover(parent,parent),null);
});
test('Detailed cap validation rejects crossing, backtracking, duplicate, missing or excessive controls',()=>{
 for(const paths of [[],[cuts[0]],[[cuts[0][0],cuts[0][0]],cuts[1]],[[...cuts[0],cuts[0][1]],cuts[1]],[[...Array(41)].map((_,i)=>[39.002,32+i*.0001]),cuts[1]],[[[39.001,32],[39.009,32.02]],[[39.009,32],[39.001,32.02]]]])assert.throws(()=>api.between(parent,paths,ports));
});
test('Real Dikmen detailed cut edit preserves the real irregular perimeter and existing storage limit',()=>{
 const {geometry:g}=JSON.parse(readFileSync(new URL('./fixtures/park-stages/dikmen-boundary.json',import.meta.url))),points=g.outer.flat(),left=Math.min(...points.map(p=>p[1])),right=Math.max(...points.map(p=>p[1])),lo=Math.min(...points.map(p=>p[0])),h=Math.max(...points.map(p=>p[0]))-lo;
 const paths=[[[lo+h*.2,left],[lo+h*.24,(left+right)/2],[lo+h*.2,right]],[[lo+h*.8,left],[lo+h*.75,(left+right)/2],[lo+h*.8,right]]],result=api.between(g,paths,ports);
 assert.deepEqual(polygon.difference(mp(result.geometry),mp(g)),[]);assert.ok(result.geometry.outer.every(r=>r.length<=301));
 // One cap leaves/re-enters this real perimeter, producing three disconnected
 // cut fragments. Do not invent their missing connection or expose park edges.
 assert.equal(api.recover(g,result.geometry),null);
});
