import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPublicationRequestHandler} from '../scripts/lib/report-publication-request.mjs';

const publication={id:'DGR-2026-0001',hash:'digest',version:1,n:3};
function fixture({archiveError=false,publishError=null}={}) {
  const calls=[];
  const handle=createPublicationRequestHandler({
    now:()=> '2026-10-11T12:00:00Z',
    publicationOptions:(req,flags)=>{calls.push(['options',flags]);return {flag:flags.accepted};},
    publishPark:async(park,options)=>{calls.push(['publish',park,options]);if(publishError)throw publishError;return publication;},
    applyAcceptedSurfaceSnapshot:async(pub,snapshot)=>{calls.push(['accepted',pub.id]);return {...pub,hash:'accepted-digest',surface_revision:snapshot.revision};},
    measureArchive:async id=>{calls.push(['archive',id]);if(archiveError)throw Error('unavailable');return 123;}
  });
  return {handle,calls};
}

test('accepted result is applied before archive measurement and logged with its hash',async()=>{
  const f=fixture();
  const entry=await f.handle({id:12,park_id:5,surface_snapshot:{schema:'dendrogeo-surface-accepted/1',accepted_at:'2026-10-03',areas_m2:{green:100},revision:7}});
  assert.deepEqual(f.calls.map(call=>call[0]),['options','publish','accepted','archive']);
  assert.equal(entry.status,'Yayınlandı');
  assert.equal(entry.request_id,'12');
  assert.equal(entry.report_hash,'sha256:accepted-digest');
  assert.equal(entry.surface_revision,7);
  assert.equal(entry.archive_bytes,123);
  assert.equal(entry.finished_at,'2026-10-11T12:00:00Z');
});

test('geometry snapshot bypasses accepted-area workflow and archive failures remain nonfatal',async()=>{
  const f=fixture({archiveError:true});
  const entry=await f.handle({id:'request',park_id:5,with_lulc:false,surface_snapshot:{schema:'dendrogeo-surface/2'}});
  assert.deepEqual(f.calls[0],['options',{accepted:false,geometrySnapshot:true}]);
  assert.equal(f.calls.some(call=>call[0]==='accepted'),false);
  assert.equal(entry.status,'Yayınlandı');
  assert.equal(entry.archive_bytes,null);
  assert.equal(entry.with_lulc,false);
});

test('unknown surface schema fails before publication dependencies are invoked',async()=>{
  const f=fixture();
  const entry=await f.handle({id:'bad',park_id:5,surface_snapshot:{schema:'unknown'}});
  assert.equal(entry.status,'Başarısız');
  assert.match(entry.message,/Bilinmeyen kayıtlı analiz şeması/);
  assert.deepEqual(f.calls,[]);
});

test('publisher failure is bounded and does not apply or measure a report',async()=>{
  const f=fixture({publishError:Error('x'.repeat(500))});
  const entry=await f.handle({id:'failed',park_id:5});
  assert.equal(entry.status,'Başarısız');
  assert.equal(entry.message.length,400);
  assert.deepEqual(f.calls.map(call=>call[0]),['options','publish']);
});
