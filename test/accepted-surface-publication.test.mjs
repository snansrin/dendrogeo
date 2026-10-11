import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createAcceptedSurfacePublisher} from '../scripts/lib/accepted-surface-publication.mjs';
import {canonicalHash} from '../scripts/lib/canonical-hash.mjs';

const accepted = {schema:'dendrogeo-surface-accepted/1', accepted_at:'2026-10-03T18:00:00Z', revision:7, areas_m2:{green:30000,building:20000}};
const publication = {id:'DGR-2026-0001', url:'https://dendrogeo.org/rapor/DGR-2026-0001/',version:2};
function fixture({missing=false}={}) {
  const writes = new Map(), removed = [], indexed = [], rendered = [];
  const apply = createAcceptedSurfacePublisher({
    defaultRoot:'fixture', existsSync:()=>!missing,
    readFileSync:()=>JSON.stringify({park:{id:5,area_m2:50000},provenance:{git_commit:'commit'}}),
    writeFileSync:(path,value)=>writes.set(path,value), unlinkSync:path=>{removed.push(path);throw Error('missing map');},
    renderReport:(snapshot,options)=>{rendered.push(options);return '<meta property="og:image" content="harita.png"><p>report</p>';},
    buildMetadata:(snapshot,options)=>({id:options.id,hash:options.hash,revision:snapshot.lulc.revision}),
    qrDataUri:async()=> 'qr', parkHistory:()=>['previous'], rebuildIndex:path=>indexed.push(path)
  });
  return {apply,writes,removed,indexed,rendered};
}

test('accepted surface publication preserves report identity and hashes the persisted snapshot', async () => {
  const f=fixture();
  const result=await f.apply(publication,accepted,'alternate');
  const dir=join('alternate','rapor',publication.id);
  const snapshot=JSON.parse(f.writes.get(join(dir,'data.json')));
  assert.equal(result.id,publication.id);
  assert.equal(result.hash,canonicalHash(snapshot));
  assert.equal(snapshot.lulc.coverage_m2,50000);
  assert.equal(snapshot.provenance.git_commit,'commit');
  assert.equal(snapshot.provenance.surface_review.geometry_published,false);
  assert.equal(JSON.parse(f.writes.get(join(dir,'metadata.json'))).hash,result.hash);
  assert.doesNotMatch(f.writes.get(join(dir,'index.html')),/og:image/);
  assert.deepEqual(f.removed,[join(dir,'harita.png')]);
  assert.deepEqual(f.indexed,[join('alternate','rapor')]);
  assert.equal(f.rendered[0].version,2);
  assert.deepEqual(f.rendered[0].meta.history,['previous']);
});

test('unsupported snapshots cause no publication side effects', async () => {
  const f=fixture();
  assert.equal(await f.apply(publication,{schema:'unsupported'}),publication);
  assert.equal(f.writes.size,0);
  assert.deepEqual(f.removed,[]);
  assert.deepEqual(f.indexed,[]);
});

test('missing publication and empty accepted areas fail before any writes', async () => {
  const missing=fixture({missing:true});
  await assert.rejects(missing.apply(publication,accepted),/Yayın snapshot dosyası bulunamadı/);
  assert.equal(missing.writes.size,0);
  const f=fixture();
  await assert.rejects(f.apply(publication,{...accepted,areas_m2:{}}),/geçersiz veya boş/);
  assert.equal(f.writes.size,0);
});
