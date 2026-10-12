import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function adapter(){
 const window={};
 vm.runInNewContext(readFileSync(new URL('../src/adapters/visitors/track-visit.js',import.meta.url),'utf8'),{window});
 return window.DG_VISITOR_TRACK_VISIT_ADAPTER.create();
}

test('visit adapter posts one empty row with the RLS-safe minimal-return headers',async()=>{
 const calls=[],response={status:201};
 const result=await adapter().record((url,options)=>{calls.push({url,options});return Promise.resolve(response);},'https://qa.supabase.co','anon-key');
 assert.equal(result,response);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://qa.supabase.co/rest/v1/site_visits');
 assert.equal(calls[0].options.method,'POST');
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.headers)),{
  apikey:'anon-key',Authorization:'Bearer anon-key','Content-Type':'application/json',Prefer:'return=minimal'
 });
 assert.deepEqual(JSON.parse(calls[0].options.body),[{}]);
});

test('visit adapter leaves transport errors for the service catch boundary',async()=>{
 await assert.rejects(adapter().record(()=>Promise.reject(Error('offline')),'https://qa.supabase.co','anon-key'),/offline/);
});
