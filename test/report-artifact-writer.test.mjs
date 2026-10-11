import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createReportArtifactWriter} from '../scripts/lib/report-artifact-writer.mjs';

function fixture() {
  const writes=new Map(), directories=[], renders=[];
  const write=createReportArtifactWriter({
    mkdirSync:path=>directories.push(path),writeFileSync:(path,value)=>writes.set(path,value),
    renderReport:(snap,options)=>{renders.push(options);return 'html';},
    buildMetadata:(snap,options)=>({id:options.id,hash:options.hash,version:options.version}),
    mcRowCI:()=>({lo:0,hi:0})
  });
  return {write,writes,directories,renders};
}
const input={dir:'archive',id:'DGR-2026-0001',snap:{rows:[]},hash:'digest',png:null,version:1,verTxt:'1.0',meta:{id:'DGR-2026-0001'},history:['previous']};

test('artifact writer preserves file formats, metadata identity and report history',()=>{
  const f=fixture();
  const out=f.write(input);
  assert.equal(out,join(input.dir,input.id));
  assert.deepEqual(f.directories,[out]);
  assert.deepEqual([...f.writes.keys()].map(path=>path.slice(out.length+1)),['index.html','data.json','olcum.csv','park.geojson','metadata.json']);
  assert.equal(f.writes.get(join(out,'data.json')),JSON.stringify(input.snap));
  assert.equal(f.writes.get(join(out,'metadata.json')),JSON.stringify({id:input.id,hash:'digest',version:'1.0'})+'\n');
  assert.deepEqual(JSON.parse(f.writes.get(join(out,'park.geojson'))),{type:'FeatureCollection',features:[]});
  assert.deepEqual(f.renders[0].meta.history,['previous']);
  assert.equal(input.meta.history,undefined);
});

test('optional PNG and reviewed surface geometry are written only when supplied',()=>{
  const f=fixture(),features=[{type:'Feature',properties:{class:'green'},geometry:null}],png=Buffer.from('png');
  const out=f.write({...input,png,snap:{rows:[],lulc:{review:{features}}}});
  assert.equal(f.writes.get(join(out,'harita.png')),png);
  assert.equal(f.writes.get(join(out,'surface.geojson')),JSON.stringify({type:'FeatureCollection',features}));
});
