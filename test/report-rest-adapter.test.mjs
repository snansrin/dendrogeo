import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportRestAdapter} from '../scripts/lib/report-rest-adapter.mjs';

const config='const SB_URL="https://example.supabase.co";\nconst SB_KEY="public-anon-key";';

test('builds the existing Supabase REST request and returns JSON unchanged',async()=>{
 const requests=[];
 const payload=[{id:9,park_id:4}];
 const {rest}=createReportRestAdapter({
  read:path=>{assert.equal(path,'src/config/supabase.js');return config;},
  reportRead:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>payload};}
 });
 const result=await rest('measures',{select:'*',park_id:'eq.4'});
 assert.equal(result,payload);
 assert.equal(requests.length,1);
 assert.equal(requests[0].url,'https://example.supabase.co/rest/v1/measures?select=*&park_id=eq.4');
 assert.deepEqual(requests[0].options,{headers:{apikey:'public-anon-key',Authorization:'Bearer public-anon-key'}});
});

test('preserves table and HTTP status in REST errors',async()=>{
 const {rest}=createReportRestAdapter({
  read:()=>config,
  reportRead:async()=>({ok:false,status:503})
 });
 await assert.rejects(rest('reports',{select:'id'}),/reports HTTP 503/);
});
