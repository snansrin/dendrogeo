import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderReportDocumentOpening} from '../scripts/lib/report-document-opening.mjs';

test('opening composer preserves cover, study, disclosure, overview and source order',()=>{
  const calls=[];
  const render=(name,marker)=>value=>{calls.push([name,value]);return marker;};
  const input={
    renderCoverPresentation:render('cover','<header>cover</header>'),cover:{id:'DGR-1'},
    renderStudyPresentation:render('study','<section>study</section>'),study:{period:'period'},
    renderOverviewPresentation:render('overview','<section>overview</section>'),overview:{park:'park'},
    renderSourcesPresentation:render('sources','<section>sources</section>'),sources:{dataset:'dataset'},
  };
  const html=renderReportDocumentOpening(input);
  assert.equal(html,'<header>cover</header>\n<section>study</section>\n<p class="stmt">Bu rapor, DendroGeo analiz sistemi tarafından belirlenen yöntem, veri kaynakları ve kalite kontrol prosedürleri doğrultusunda oluşturulmuştur. Rapor bir akreditasyon veya sertifikasyon belgesi değildir; bulgular, beyan edilen veri kaynakları ve çözümleme sürümü kapsamında geçerlidir.</p>\n\n<section>overview</section>\n<h2><span class="no">3</span>Veri Kaynakları</h2>\n<section>sources</section>');
  assert.deepEqual(calls.map(([name])=>name),['cover','study','overview','sources']);
  assert.deepEqual(calls.map(([,value])=>value),[input.cover,input.study,input.overview,input.sources]);
});
