import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseZenodoDepositState} from '../scripts/lib/publication.mjs';
import {activePublishedReports} from '../scripts/register-pending-dois.mjs';

test('Zenodo taslak durumu rapor kimliğine ve pozitif tamsayı kimliğe bağlıdır',()=>{
 assert.deepEqual(parseZenodoDepositState('{"id":42,"report_id":"DGR-2026-0021"}','DGR-2026-0021'),{id:42,report_id:'DGR-2026-0021'});
 for(const state of ['bozuk JSON',JSON.stringify({id:42,report_id:'DGR-2026-0022'}),JSON.stringify({id:'42',report_id:'DGR-2026-0021'}),JSON.stringify({id:0,report_id:'DGR-2026-0021'})])assert.throws(()=>parseZenodoDepositState(state,'DGR-2026-0021'));
});


test('otomatik DOI yalnız aktif ve geri çekilmemiş üretim raporlarını seçer',()=>{
 const q={entries:[
  {status:'Yayınlandı',report_id:'DGR-2026-0021'},
  {status:'Geri çekildi',report_id:'DGR-2026-0021'},
  {status:'Yayınlandı',report_id:'DGR-2026-0022'},
  {status:'Başarısız',report_id:null},
  {status:'Yayınlandı',report_id:'javascript:bad'}
 ]};
 assert.deepEqual(activePublishedReports(q).map(([id])=>id),['DGR-2026-0022']);
});
