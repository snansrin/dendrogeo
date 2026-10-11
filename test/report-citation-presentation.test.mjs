import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportCitationPresentation} from '../scripts/lib/report-citation-presentation.mjs';
import {citeName} from '../scripts/lib/report-formatting.mjs';

const render = createReportCitationPresentation({citeName, siteOrigin:'https://reports.example'});
const base = {snap:{generated_at:'2026-10-11T12:00:00Z'}, P:{name:'Deneme Parkı',city:'Ankara',country:'Türkiye'}, id:'DGR-2026-0042', hash:'1234567890abcdef9876543210', verTxt:'2.0', doi:null, L:null, dataYear:2025};

test('personal author, DOI and version agree across citation formats',()=>{
  const snap = Object.freeze({...base.snap,author:Object.freeze({name:'Nagihan Şirin'}),study:Object.freeze({title:'Saha araştırması'})});
  const {AU,citePlain,bib,jsonld} = render({...base,snap,doi:'10.1234/example',L:{}});
  assert.equal(AU,snap.author);
  assert.match(citePlain,/Şirin, N\. \(2026\)\. Saha araştırması/);
  assert.ok(citePlain.endsWith('https://doi.org/10.1234/example'));
  assert.match(bib,/@techreport\{dgr20260042/);
  assert.match(bib,/version   = \{2.0\}/);
  assert.match(bib,/doi       = \{10.1234\/example\}/);
  assert.match(bib,/sha256:1234567890abcdef…/);
  assert.deepEqual(jsonld.author,[{'@type':'Person',name:'Nagihan Şirin'}]);
  assert.equal(jsonld.contributor.length,2);
  assert.equal(jsonld.identifier.value,'10.1234/example');
  assert.equal(jsonld.citation.length,2);
  assert.equal(jsonld.temporalCoverage,'2025');
});

test('missing author, study and DOI preserve institutional and park fallbacks',()=>{
  const {citePlain,bib,jsonld} = render(base);
  assert.match(citePlain,/DendroGeo \(2026\)\. Deneme Parkı ağaç envanteri/);
  assert.ok(citePlain.endsWith('https://reports.example/rapor/DGR-2026-0042/'));
  assert.match(bib,/DendroGeo \(kurumsal yazar\)/);
  assert.doesNotMatch(bib,/doi       =/);
  assert.equal(jsonld.identifier,base.id);
  assert.deepEqual(jsonld.author,[{'@type':'Organization',name:'DendroGeo'}]);
  assert.equal(jsonld.citation.length,1);
  assert.match(jsonld.name,/Deneme Parkı: Bireysel Ağaç Envanteri/);
  assert.equal(jsonld.datePublished,'2026-10-11');
});
