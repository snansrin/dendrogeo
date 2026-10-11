import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportStudyPresentation} from '../scripts/lib/report-study-presentation.mjs';

const render=createReportStudyPresentation({esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')});

test('missing study emits no context and optional empty fields stay absent',()=>{
  assert.equal(render({}),'');
  const html=render({study:{purpose:'Amaç',institution:'',sampling:'',instruments:''}});
  assert.match(html,/Çalışmanın amacı ve kapsamı/);
  assert.doesNotMatch(html,/Üniversite \/ kurum|Örnekleme tasarımı|Saha yöntemi ve ölçüm cihazları|Bağımsız çalışma/);
});

test('declared context retains field order, project layout, escaping and independence',()=>{
  const study=Object.freeze({project_name:'<proje',institution:'Kurum & bölüm',advisor:'Danışman',independent:true,purpose:'<amaç',sampling:'<örneklem',instruments:'<cihaz'});
  const html=render(Object.freeze({study}));
  assert.match(html,/<div class="meta-wide"><b>Proje/);
  assert.ok(html.indexOf('<b>Proje')<html.indexOf('<b>Üniversite / kurum'));
  assert.ok(html.indexOf('<b>Üniversite / kurum')<html.indexOf('<b>Danışman'));
  for(const value of ['&lt;proje','Kurum &amp; bölüm','&lt;amaç','&lt;örneklem','&lt;cihaz','Bağımsız çalışma'])assert.ok(html.includes(value));
  assert.equal(study.project_name,'<proje');
});
