import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportDocumentHead} from '../scripts/lib/report-document-head.mjs';

const render=createReportDocumentHead({esc:v=>String(v).replaceAll('<','&lt;'),fmtT:v=>String(v/1000),reportStyles:id=>`/* ${id} */`,siteOrigin:'https://reports.example'});
const base={id:'DGR-2026-0042',P:{name:'<park',city:'Ankara'},t:{n:3,ci:{mean:1000,lo:500,hi:1500}},dataset:'<source',ciTxt:'1 t',hash:'1234567890abcdef',L:null,jsonld:{'@type':'Report',name:'Rapor'}};

test('document metadata preserves escaped values, canonical links and structured identity',()=>{
  const html=render(base);
  assert.match(html,/&lt;park/);
  assert.match(html,/&lt;source/);
  assert.match(html,/toplam karbon 1 t/);
  assert.match(html,/rel="canonical" href="https:\/\/reports.example\/rapor\/DGR-2026-0042\/"/);
  assert.match(html,/sha256:1234567890ab…/);
  assert.ok(html.includes(JSON.stringify(base.jsonld)));
  assert.match(html,/<style>\/\* DGR-2026-0042 \*\/<\/style>/);
});

test('image sharing cards depend only on the existing surface-result condition',()=>{
  const text=render(base);
  assert.doesNotMatch(text,/og:image/);
  assert.match(text,/name="twitter:card" content="summary"/);
  const image=render({...base,L:{}});
  assert.match(image,/og:image" content="https:\/\/reports.example\/rapor\/DGR-2026-0042\/harita.png/);
  assert.match(image,/summary_large_image/);
});
