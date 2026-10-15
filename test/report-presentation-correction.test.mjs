import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalHash} from '../scripts/lib/canonical-hash.mjs';
import {correctReportPresentation} from '../scripts/lib/report-presentation-correction.mjs';

test('map correction preserves every scientific field and leaves original snapshot unchanged',()=>{
 const source={generated_at:'2026-10-14T12:00:00Z',provenance:{report_id:'DGR-2026-0024',git_commit:'analysis-code'},rows:[{carbon_kg:12.34}],totals:{carbon_kg:12.34},lulc:{review:{features:[{id:'hard'}],areas:{hard:123},acceptedAt:'2026-10-13'}}};
 const before=structuredClone(source),metadata={identifier:'DGR-2026-0024',resultHash:'sha256:'+canonicalHash(source),doi:'10.5281/zenodo.123'};
 const opts={source,metadata,id:'DGR-2026-0025',generatedAt:'2026-10-15T12:00:00Z',gitCommit:'renderer-code'};
 const {snap,hash}=correctReportPresentation(opts);
 assert.deepEqual(source,before);
 for(const key of ['rows','totals','lulc'])assert.deepEqual(snap[key],source[key]);
 assert.equal(snap.provenance.git_commit,'analysis-code');
 assert.equal(snap.presentation_correction.source_result_hash,metadata.resultHash);
 assert.equal(snap.presentation_correction.source_doi,metadata.doi);
 assert.equal(hash,canonicalHash(snap));
 assert.notEqual(hash,canonicalHash(source));
 assert.throws(()=>correctReportPresentation({...opts,id:metadata.identifier}),/yeni rapor/);
 assert.throws(()=>correctReportPresentation({...opts,metadata:{...metadata,resultHash:'wrong'}}),/bütünlüğü/);
});
