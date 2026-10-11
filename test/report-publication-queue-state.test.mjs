import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/application/reports/collect-publication-request.js',import.meta.url),'utf8');
function state({now=()=>Date.parse('2026-10-11T12:00:00Z')}={}){
 const context=vm.createContext({window:{},Set,JSON,Object,Math,Date,String});
 vm.runInContext(source,context);
 return context.window.DG_REPORT_PUBLICATION_REQUEST_APPLICATION.createReportPublicationQueueState({
  isReportId:value=>/^DGR-\d{4}-\d{4}$/.test(String(value||'')),now
 });
}

test('en son istek sonucu seçilir; arşivlenmiş istek iptal durumunda kalır',()=>{
 const q=state();
 const queue={entries:[
  {request_id:'r1',status:'Başarısız'},
  {request_id:'r1',status:'Yayınlandı',report_id:'DGR-2026-0012',finished_at:'2026-10-10T00:00:00Z'}
 ],archived_request_ids:['r2']};
 assert.equal(q.entryFor(queue,'r1').status,'Yayınlandı');
 assert.equal(q.status({id:'r1'},queue).reportId,'DGR-2026-0012');
 assert.equal(q.status({id:'r2'},queue).key,'cancelled');
});

test('geri çekilen ve bozuk kimlikli kayıtlar aktif yayın sayılmaz',()=>{
 const q=state();
 const queue={entries:[
  {status:'Yayınlandı',park_id:7,report_id:'DGR-2026-0001'},
  {status:'Geri çekildi',park_id:7,report_id:'DGR-2026-0001',retraction_id:'ret1'},
  {status:'Yayınlandı',park_id:8,report_id:'javascript:alert(1)'}
 ]};
 assert.deepEqual(Object.keys(q.publishedByPark(queue)),[]);
 assert.equal(q.retractedIds(queue)['DGR-2026-0001'].retraction_id,'ret1');
});

test('geri çekme tamamlanma sırası, park seçimi ve test arşivi korunur',()=>{
 const q=state();
 const first={status:'Geri çekildi',park_id:'7',report_id:'DGR-2026-0001',retraction_id:'ret1'};
 const latest={status:'Geri çekildi',park_id:7,report_id:'DGR-2026-0002',retraction_id:'ret2'};
 const queue={entries:[first,latest],archived_retraction_ids:['ret0']};
 assert.equal(q.retractionDone(queue,'ret1'),first);
 assert.equal(q.retractedInPark(queue,7),latest);
 assert.equal(q.retractionDone(queue,'ret0').status,'Test arşivi');
});

test('bekleyen durum notu saat enjeksiyonuyla kararlı hesaplanır',()=>{
 const q=state();
 const req={id:'r3',status:'Beklemede',created_at:'2026-10-11T11:30:00Z'};
 assert.equal(q.status(req,{entries:[]}).note,'30 dk önce kuyruğa alındı');
});
