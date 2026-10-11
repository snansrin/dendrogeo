import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createParkReportPublisher} from '../scripts/lib/park-report-publication.mjs';

function fixture({valid=true}={}) {
  const calls=[],study={title:'clean'},snap={park:{id:5,name:'Park',city:'City'},totals:{n:2,carbon_kg:100,per_ha_kg:50,ci:{mean:100,lo:90,hi:110}},generated_at:'2026-10-11'};
  const publish=createParkReportPublisher({
    root:'fixture',siteOrigin:'https://example.test',gitCommit:'commit',engineVersion:'engine',appVersion:'app',currentYear:()=>2026,
    reportContext:{validate:()=>({valid,value:study,errors:{title:'required'}})},
    mkdirSync:()=>calls.push('mkdir'),nextReportId:()=>{calls.push('id');return 'DGR-2026-0001';},
    qrDataUri:async url=>{calls.push(['qr',url]);return 'qr';},
    buildSnapshot:async(park,options)=>{calls.push(['snapshot',park,options]);return {snap,hash:'digest',png:null};},
    parkHistory:()=>[{id:'old'},{id:'withdrawn',retracted:true}],
    writeReportArtifacts:options=>calls.push(['artifacts',options]),rebuildIndex:()=>calls.push('index'),
    fmtT:value=>String(value/1000),citeName:value=>value
  });
  return {publish,calls,study,snap};
}

test('publication assigns identity before snapshot and writes artifacts before index refresh',async()=>{
  const f=fixture();
  const result=await f.publish('5',{study:{title:'raw'},skipLulc:true,surfaceSnapshot:{schema:'geometry'}});
  assert.deepEqual(f.calls.map(c=>Array.isArray(c)?c[0]:c),['mkdir','id','qr','snapshot','artifacts','index']);
  const options=f.calls.find(c=>c[0]==='snapshot')[2];
  assert.equal(options.meta.id,result.id);
  assert.equal(options.meta.study,f.study);
  assert.equal(options.meta.git_commit,'commit');
  assert.equal(options.skipLulc,true);
  assert.deepEqual(options.surfaceSnapshot,{schema:'geometry'});
  assert.equal(result.hash,'digest');
  assert.deepEqual(result.supersedes,['old']);
  assert.equal(result.url,'https://example.test/rapor/DGR-2026-0001/');
});

test('invalid publication context fails before identity or filesystem operations',async()=>{
  const f=fixture({valid:false});
  await assert.rejects(f.publish(5),/Yayın künyesi gerekli: required/);
  assert.deepEqual(f.calls,[]);
});
