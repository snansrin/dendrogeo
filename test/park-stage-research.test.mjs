import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectMemberTopology} from '../research/park-stages/osm-topology.mjs';
import {catalog} from '../research/park-stages/catalog.mjs';
import {describeScope, selectStageDraft, geometryDigest} from '../research/park-stages/selection-draft.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/park-stages/dikmen-topology.json', import.meta.url)));
const copy = value => JSON.parse(JSON.stringify(value));
const way = (id,nodes) => ({type:'way',id,nodes});
const relation = ways => ({type:'relation',tags:{type:'multipolygon'},members:ways.map(w => ({type:'way',ref:w.id,role:w.role || 'outer'}))});

test('Dikmen snapshot: four ways form one 318-node cycle, without stage inference or input mutation', () => {
  const before=JSON.stringify(fixture), result=inspectMemberTopology(fixture.relation,fixture.ways);
  assert.equal(result.ok,true); assert.equal(result.rings.length,1);
  assert.equal(result.rings[0].nodes.length,318); assert.equal(result.rings[0].role,'outer');
  assert.equal(Object.hasOwn(result,'stageCount'),false); assert.equal(JSON.stringify(fixture),before);
});
test('Member order and way direction do not change topology', () => {
  const ways=copy(fixture.ways).reverse(); ways.forEach(w => w.nodes.reverse());
  const rel=copy(fixture.relation); rel.members.reverse();
  assert.equal(inspectMemberTopology(rel,ways).rings[0].nodes.length,318);
});
test('Disconnected outers, hole and island retain roles; none becomes a bridge or named stage', () => {
  const ways=[way(1,[1,2,3,1]),way(2,[4,5,6,4]),{...way(3,[7,8,9,7]),role:'inner'},way(4,[10,11,12,10])];
  const result=inspectMemberTopology(relation(ways),ways);
  assert.equal(result.ok,true); assert.equal(result.rings.filter(r=>r.role==='outer').length,3);
  assert.equal(result.rings.filter(r=>r.role==='inner').length,1);
});
for (const [label, mutate, reason] of [
  ['missing way', f=>f.ways.pop(),'missing-way'],
  ['missing role', f=>{f.relation.members[0].role='';},'unsupported-member'],
  ['duplicate member', f=>f.relation.members.push(copy(f.relation.members[0])),'duplicate-member'],
  ['duplicate way', f=>f.ways.push(copy(f.ways[0])),'duplicate-way'],
  ['open chain', f=>{f.ways[0].nodes[0]=999999999999;},'open-or-ambiguous-chain'],
  ['invalid node', f=>{f.ways[0].nodes[0]=NaN;},'invalid-node']
]) test(`Topology rejects ${label} without returning partial rings`, () => {
  const f=copy(fixture); mutate(f); const result=inspectMemberTopology(f.relation,f.ways);
  assert.equal(result.ok,false); assert.equal(result.reason,reason); assert.deepEqual(result.rings,[]);
});
test('Ambiguous shared endpoints and collapsed rings fail closed', () => {
  for (const ways of [[way(1,[1,2,3,1]),way(2,[1,4,5,1])],[way(1,[1,2,1])]]) {
    assert.equal(inspectMemberTopology(relation(ways),ways).ok,false);
  }
});
test('Names alone cannot enable Dikmen stage geometry; Öveçler has no inferred OSM identity', () => {
  const scope=describeScope(catalog,'relation/14290362');
  assert.equal(scope.sections.length,2); assert.ok(scope.sections.every(s=>!s.selectable));
  assert.equal(describeScope(catalog,'Dikmen Vadisi').status,'unlinked');
  assert.equal(describeScope(catalog,'node/9843922087').status,'unlinked');
  assert.equal(selectStageDraft({catalog,parkKey:'relation/14290362',sectionIds:['dikmen-1-2'],enabled:true}).reason,'boundary-not-verified');
});
test('Disabled flag returns existing scope without consulting any catalog', () => {
  assert.deepEqual(selectStageDraft({catalog:null,parkKey:'anything'}),{ok:true,kind:'existing-scope',analysisEnabled:false});
});
function verifiedCatalog() {
  const c=copy(catalog), section=c.groups[0].sections[0];
  section.geometry={type:'MultiPolygon',coordinates:[
    [[[32,39],[33,39],[33,40],[32,39]],[[32.4,39.1],[32.6,39.1],[32.6,39.2],[32.4,39.1]]],
    [[[34,39],[35,39],[35,40],[34,39]]]
  ]};
  section.boundaryStatus='verified';
  section.boundarySource={url:'https://example.invalid/synthetic-only',version:'fixture-v1',license:'CC0-1.0'};
  section.review={reviewer:'synthetic-test',reviewedAt:'2026-10-24',topology:'validated',geometrySha256:geometryDigest(section.geometry)};
  return c;
}
const select = (c, ids=['dikmen-1-2']) => selectStageDraft({catalog:c,parkKey:'relation/14290362',sectionIds:ids,enabled:true});
test('Single verified synthetic stage draft preserves separated polygons, holes, source and digest', () => {
  const c=verifiedCatalog(), before=JSON.stringify(c), draft=select(c);
  assert.equal(draft.ok,true); assert.equal(draft.kind,'stage-preview'); assert.equal(draft.analysisEnabled,false);
  assert.deepEqual(draft.geometry,c.groups[0].sections[0].geometry);
  assert.ok(Object.isFrozen(draft.geometry.coordinates[0][0][0]));
  c.groups[0].sections[0].geometry.coordinates[0][0][0][0]=0;
  assert.equal(draft.geometry.coordinates[0][0][0][0],32);
  assert.equal(JSON.stringify(verifiedCatalog()),before);
});
for (const [label, mutate] of [
  ['stale digest', s=>{s.geometry.coordinates[0][0][0][0]=31;}],
  ['missing license', s=>{delete s.boundarySource.license;}],
  ['missing version', s=>{delete s.boundarySource.version;}],
  ['unreviewed topology', s=>{delete s.review.topology;}],
  ['invalid date', s=>{s.review.reviewedAt='invalid';}],
  ['out of range', s=>{s.geometry.coordinates[0][0][1][1]=100;}],
  ['open polygon', s=>{s.geometry.coordinates[0][0].pop();}]
]) test(`Stage selection rejects ${label}`, () => {
  const c=verifiedCatalog(); mutate(c.groups[0].sections[0]);
  assert.equal(select(c).reason,'boundary-not-verified');
});
test('Empty, duplicate, foreign and unimplemented union selections cannot produce a geometry', () => {
  const c=verifiedCatalog();
  for (const [ids,reason] of [[[],'empty-selection'],[['dikmen-1-2','dikmen-1-2'],'duplicate-selection'],[['ovecler-1'],'unknown-section']]) {
    const result=select(c,ids); assert.equal(result.reason,reason); assert.equal(result.geometry,undefined);
  }
  const second=copy(c.groups[0].sections[0]); second.id='dikmen-3'; c.groups[0].sections[1]=second;
  assert.equal(select(c,['dikmen-1-2','dikmen-3']).reason,'union-not-implemented');
});
test('Conflicting park identity links fail closed rather than picking first catalog row', () => {
  const c=verifiedCatalog(); c.groups.push(copy(c.groups[0]));
  assert.equal(select(c).reason,'ambiguous-identity');
});
test('Malformed catalog, duplicate stage identity and missing name evidence fail closed', () => {
  assert.equal(select(null).reason,'invalid-catalog');
  const c=verifiedCatalog(); c.groups[0].sections.push(copy(c.groups[0].sections[0]));
  assert.equal(select(c).reason,'invalid-catalog');
  c.groups[0].sections.pop(); c.groups[0].sources=[];
  assert.equal(select(c).reason,'invalid-catalog');
  const conflict=verifiedCatalog(); conflict.groups[1].id=conflict.groups[0].id;
  assert.equal(select(conflict).reason,'invalid-catalog');
});
test('Research modules are not referenced by runtime loaders or service worker', () => {
  for (const path of ['../partials/head.html','../partials/boot.html','../src/utils/lazylibs.js','../sw.js']) {
    assert.doesNotMatch(readFileSync(new URL(path,import.meta.url),'utf8'),/research\/park-stages/);
  }
});
