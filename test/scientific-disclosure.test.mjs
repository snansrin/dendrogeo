import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createScientificDisclosure,renderScientificDisclosure} from '../scripts/lib/report-scientific-disclosure.mjs';
import {compareCarbonReference} from '../scripts/check-carbon-reference.mjs';
import {reportContext} from '../scripts/lib/report-context.mjs';
import {renderReport,buildMetadata} from '../scripts/make-report.mjs';
import {scriptSafeJson} from '../scripts/lib/script-safe-json.mjs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

test('optional field-method declarations survive consent/decode without changing numerical values',()=>{
  const study={inventory_scope:'partial',sampling:'Accessible trees only',instruments:'Tape; height instrument unknown',
    observers:'Field team',calibration:'Not performed',repeat_measurements:'No independent repeat'};
  assert.equal(reportContext.validate({}).valid,true);
  const result=reportContext.decode({schema:'dendrogeo-report-context/1',study,publication_consent:true});
  for(const [key,value] of Object.entries(study))assert.equal(result[key],value);
  assert.equal(reportContext.validate({inventory_scope:'made_up_census'}).valid,false);
  assert.ok(!('rho' in reportContext.clean({...study,rho:999,carbon_kg:111})));
  assert.equal(reportContext.clean({calibration:'x'.repeat(1300)}).calibration.length,1200);
});

test('disclosure separates assumed errors and missing evidence without inventing calibration or census',()=>{
  const snap=Object.freeze({mc:Object.freeze({GIRTH_SD_CM:.5,H_SD_M:.25,MODEL_CV:.22})});
  const disclosure=createScientificDisclosure(snap),html=renderScientificDisclosure(disclosure,{esc});
  assert.equal(disclosure.sampling.scope,'unknown');
  assert.equal(disclosure.uncertainty.measurement.girthSdCm,.5);
  assert.equal(disclosure.uncertainty.density.propagated,false);
  assert.equal(disclosure.uncertainty.sampling.propagated,false);
  assert.equal(disclosure.missingDeclarations.length,6);
  assert.match(html,/kalibrasyonu kanıtı değildir/);
  assert.match(html,/korel/);
  const legacy=createScientificDisclosure({mc:{DBH_SD_CM:.5}});
  assert.equal(legacy.uncertainty.measurement.girthSdCm,null);
  assert.match(renderScientificDisclosure(legacy,{esc}),/yeniden yorumlanmadı/);
});

test('new report presentation/metadata carries research disclosures; frozen rows, totals and geometry remain identical',()=>{
  const snap=JSON.parse(read('test/fixtures/report-snapshot.json'));
  snap.study={inventory_scope:'partial',observers:'<script>observer</script>',calibration:'Not documented',repeat_measurements:'None'};
  const before=JSON.stringify(snap),options={id:'DGR-2026-0021',hash:'f'.repeat(64)};
  const html=renderReport(snap,options),meta=buildMetadata(snap,options);
  assert.match(html,/Belirsizlik kaynakları ve mevcut hesabın kapsamı/);
  assert.match(html,/&lt;script&gt;observer/);
  assert.doesNotMatch(html,/<script>observer/);
  assert.equal(meta.scientificDisclosure.sampling.scope,'partial');
  assert.equal(meta.scientificDisclosure.sampling.calibration,'Not documented');
  assert.equal(JSON.stringify(snap),before);
});

test('all 49 species and both fallback groups match frozen independent Python reference vectors',()=>{
  const fixture=JSON.parse(read('test/fixtures/carbon-reference-v1.json'));
  const result=compareCarbonReference(fixture.expected,fixture);
  assert.equal(result.cases,147);
  assert.equal(result.species,49);
  assert.ok(result.comparisons>3500);
  const corrupt=structuredClone(fixture.expected);corrupt[0].total_carbon*=Math.PI;
  assert.throws(()=>compareCarbonReference(corrupt,fixture));
});

test('optional research controls keep existing UI classes and flow diagram artifacts are removed',()=>{
  const source=read('src/ui/report-question-fields.js');
  assert.match(source,/dg-field-protocol/);
  assert.doesNotMatch(source,/required[= ]/);
  for(const key of ['inventory_scope','observers','calibration','repeat_measurements'])assert.ok(source.includes(key));
  for(const path of ['docs/SYSTEM-FLOWS-2026-10-17.md','docs/academic/2026-10-17/flow-explorer.html',
    'docs/academic/2026-10-17/workflows.json','scripts/render-system-flows.mjs','test/system-flows.test.mjs']) {
    assert.equal(existsSync(new URL('../'+path,import.meta.url)),false,path);
  }
});

test('research declarations cannot break out of embedded snapshot or JSON-LD script elements',()=>{
  const data={value:'</script><script>globalThis.injected=true</script> & \u2028',nested:{girth_cm:50}};
  const encoded=scriptSafeJson(data);
  assert.ok(!encoded.includes('<'));
  assert.deepEqual(JSON.parse(encoded),data);
  const reconstructed=vm.runInNewContext('('+encoded+')');
  assert.equal(reconstructed.value,data.value);
  const snap=JSON.parse(read('test/fixtures/report-snapshot.json'));
  snap.study={title:data.value,calibration:data.value};
  const html=renderReport(snap,{id:'DGR-2026-0021',hash:'f'.repeat(64)});
  assert.ok(!html.includes('</script><script>globalThis.injected'));
});
