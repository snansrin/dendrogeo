import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createReportRetractionHandler, RETRACT_FILES} from '../scripts/lib/report-retraction-workflow.mjs';

const request={id:'ret',report_id:'DGR-2026-0001',park_id:5,reason:'reason'};
function fixture({exists=true,writeError=false}={}) {
  const calls=[];
  const handle=createReportRetractionHandler({
    defaultRoot:'fixture', now:()=> '2026-10-11T12:00:00Z',
    isReportId:value=>/^DGR-\d{4}-\d{4}$/.test(value),
    existsSync:path=>{calls.push(['exists',path]);return exists;},
    unlinkSync:path=>{calls.push(['unlink',path]);throw Error('already missing');},
    renderRetractionNotice:options=>{calls.push(['notice',options]);return 'notice';},
    writeFileSync:(path,value)=>{calls.push(['write',path,value]);if(writeError)throw Error('x'.repeat(500));},
    rebuildIndex:path=>calls.push(['index',path])
  });
  return {handle,calls};
}

test('missing data files still allow notice and archive index, using the supplied root',()=>{
  const f=fixture();
  const entry=f.handle(request,{park_name:'Park'},'alternate');
  const dir=join('alternate','rapor',request.report_id);
  assert.equal(entry.status,'Geri çekildi');
  assert.deepEqual(f.calls.filter(c=>c[0]==='unlink').map(c=>c[1]),RETRACT_FILES.map(name=>join(dir,name)));
  assert.deepEqual(f.calls.slice(-2),[['write',join(dir,'index.html'),'notice'],['index',join('alternate','rapor')]]);
  assert.equal(f.calls.find(c=>c[0]==='notice')[1].parkName,'Park');
  assert.equal(entry.finished_at,'2026-10-11T12:00:00Z');
});

test('invalid identities and missing archives cause no deletion or notice writes',()=>{
  const f=fixture();
  assert.equal(f.handle({...request,report_id:'../outside'},null).status,'Geri çekme başarısız');
  assert.deepEqual(f.calls,[]);
  const missing=fixture({exists:false});
  assert.equal(missing.handle(request,null).status,'Geri çekme başarısız');
  assert.deepEqual(missing.calls.map(c=>c[0]),['exists']);
});

test('notice write failure is bounded, retains request identity and does not rebuild index',()=>{
  const f=fixture({writeError:true});
  const entry=f.handle({...request,reason:'r'.repeat(500)},null);
  assert.equal(entry.status,'Geri çekme başarısız');
  assert.equal(entry.message.length,400);
  assert.equal(entry.reason.length,400);
  assert.equal(entry.retraction_id,'ret');
  assert.equal(f.calls.some(c=>c[0]==='index'),false);
});
