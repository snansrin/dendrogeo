import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportPublicationApplication} from '../scripts/lib/report-publication-application.mjs';

test('composition is lazy and CLI publishes through the shared artifact writer',async()=>{
  const calls=[],writes=[];
  const snap={park:{id:5,name:'Park'},rows:[],totals:{n:0,ci:{mean:0,lo:0,hi:0}},generated_at:'2026-10-11'};
  const application=createReportPublicationApplication({
    artifacts:{
      mkdirSync:()=>calls.push('directory'),writeFileSync:(path,value)=>writes.push([path,value]),
      renderReport:()=> 'html',buildMetadata:()=>({id:'DGR-2026-0001'}),mcRowCI:()=>({lo:0,hi:0})
    },
    publication:{
      root:'fixture',siteOrigin:'https://example.test',currentYear:()=>2026,
      reportContext:{validate:()=>({valid:true,value:{title:'Study'}})},
      mkdirSync:()=>calls.push('archive'),nextReportId:()=> 'DGR-2026-0001',qrDataUri:async()=> 'qr',
      buildSnapshot:async()=>{calls.push('snapshot');return {snap,hash:'digest'};},
      parkHistory:()=>[],rebuildIndex:()=>calls.push('index'),fmtT:String,citeName:String
    },
    cli:{
      arg:name=>name==='park'?'5':name==='publication-file'?'context.json':null,
      has:()=>false,readFileSync:()=> '{}',decodeReportContext:()=>({title:'Study'}),
      log:()=>{},error:()=>assert.fail('unexpected CLI error'),exit:()=>assert.fail('unexpected exit')
    }
  });
  assert.deepEqual(calls,[]);
  assert.deepEqual(writes,[]);
  await application.main();
  assert.deepEqual(calls,['archive','snapshot','directory','index']);
  assert.equal(writes.length,5);
  assert.ok(writes.some(([path,value])=>path.endsWith('data.json')&&value===JSON.stringify(snap)));
  assert.equal(typeof application.publishPark,'function');
});
