import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderReportDocumentBackmatter} from '../scripts/lib/report-document-backmatter.mjs';

const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const render=options=>renderReportDocumentBackmatter({
  renderProvenancePresentation:values=>'<section>Fingerprint '+values.id+'</section>',
  provenance:{id:'DGR-2026-0001'},
  histRows:'<tr><td>v1</td></tr>',
  citePlain:'Park <study> & source',
  bib:'@report{Park & study}',
  L:{citation:'Dataset <citation>'},
  renderReferencesPresentation:L=>'<section>References '+L.citation+'</section>',
  renderReportDataAccess:({L,M})=>'<section>Access '+M.engine+' '+(L?'with data':'without data')+'</section>',
  M:{engine:'DendroGeo'},
  DGR_TITLE_DEF:'DGR title',
  esc,
  ...options,
});

test('back matter renders publication record sections in order and escapes citation text',()=>{
  const html=render();
  const headings=['Fingerprint','Rapor Geçmişi','Atıf','Kaynakça','Veri Erişilebilirliği','class="foot"'];
  let previous=-1;
  for(const heading of headings){
    const position=html.indexOf(heading);
    assert.ok(position>previous,heading);
    previous=position;
  }
  assert.match(html,/Park &lt;study&gt; &amp; source/);
  assert.match(html,/@report\{Park &amp; study\}/);
  assert.match(html,/Dataset &lt;citation&gt;/);
  assert.match(html,/DendroGeo · Küresel Ağaç Envanteri/);
});

test('absent land-cover summary omits only its citation and remains passed to references and data access',()=>{
  const html=render({
    L:null,
    renderReferencesPresentation:L=>'<section>References '+String(L)+'</section>',
    renderReportDataAccess:({L,M})=>'<section>Access '+M.engine+' '+String(L)+'</section>',
  });
  assert.doesNotMatch(html,/Dataset &lt;citation&gt;/);
  assert.match(html,/References null/);
  assert.match(html,/Access DendroGeo null/);
});
