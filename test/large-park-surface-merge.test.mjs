import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import pc from 'polygon-clipping';
function output(){const w={};vm.runInNewContext(readFileSync('src/application/surface/merge-review-features.js','utf8'),{window:w});let max=0;return {api:w.DG_SURFACE_REVIEW_FEATURES.create({union:g=>{max=Math.max(max,g.length);return pc.union(...g);},unproject:g=>g}),max:()=>max};}
const rect=(x,y,w=10,h=10)=>[[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]];
const area=g=>g.reduce((sum,p)=>sum+p.reduce((a,r,i)=>{let n=0;for(let j=1;j<r.length;j++)n+=r[j-1][0]*r[j][1]-r[j][0]*r[j-1][1];return a+(i?-1:1)*Math.abs(n)/2;},0),0);
test('150000 surface parts render without argument overflow, truncation or changed areas',()=>{
 const o=output(),parts=Array.from({length:150000},(_,i)=>({type:'green',geom:rect(i%500*10,Math.floor(i/500)*10),areaM2:100,method:'review-cell'}));
 const result=o.api.merge(parts,32630);assert.equal(result.length,1);assert.equal(result[0].properties.area_m2,15000000);assert.equal(area(result[0].geometry.coordinates),15000000);assert.ok(o.max()<=128);assert.equal(parts.length,150000);
});
test('bounded union preserves holes, disjoint pieces, class totals and manual method labels',()=>{
 const o=output(),hole=rect(0,0,30,30);hole[0].push(rect(10,10,10,10)[0][0]);
 const parts=Array.from({length:260},(_,i)=>({type:i%2?'hard':'green',geom:rect(50+i*15,0),areaM2:100,method:i%2?'visual-boundary':'review-cell'}));parts.push({type:'green',geom:hole,areaM2:800,method:'visual-boundary'});
 const result=o.api.merge(parts,32630);for(const f of result){const source=parts.filter(p=>p.type===f.properties.class);assert.deepEqual(pc.xor(f.geometry.coordinates,pc.union(...source.map(p=>p.geom))),[]);assert.equal(f.properties.area_m2,source.reduce((n,p)=>n+p.areaM2,0));}assert.match(result[0].properties.method,/visual-boundary/);
});
