import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportReferencesPresentation} from '../scripts/lib/report-references-presentation.mjs';

const render=createReportReferencesPresentation({esc:v=>String(v).replaceAll('<','&lt;'),siteOrigin:'https://reports.example'});

test('baseline references retain order, scientific DOI text and site-derived methods link',()=>{
  const html=render(null);
  assert.equal((html.match(/<li>/g)||[]).length,4);
  assert.ok(html.indexOf('Zanaga')<html.indexOf('Chave'));
  assert.ok(html.indexOf('Chave')<html.indexOf('OpenStreetMap katkıcıları'));
  assert.match(html,/10.5281\/zenodo.7254221/);
  assert.match(html,/10.1111\/gcb.12629/);
  assert.match(html,/https:\/\/reports.example\/yontem\//);
  assert.match(html,/DBH = çevre\/π/);
  assert.doesNotMatch(html,/Copernicus|çapraz doğrulama veri seti/);
});

test('archived surface sources and optional cross-validation retain their conditions',()=>{
  for(const L of [{review:{}},{accepted:true}]){
    const html=render(L);
    assert.match(html,/Copernicus Sentinel-2 Level-2A/);
    assert.match(html,/data.json/);
    assert.equal((html.match(/<li>/g)||[]).length,5);
  }
  const html=render(Object.freeze({cross:'<comparison'}));
  assert.match(html,/&lt;comparison \[çapraz doğrulama veri seti\]/);
  assert.doesNotMatch(html,/Copernicus/);
});
