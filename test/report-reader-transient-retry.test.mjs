import {test} from 'node:test';
import assert from 'node:assert/strict';

const PRIVATE_URL='https://fixture.supabase.co/rest/v1/report_requests?select=id&limit=1';
const TOKEN_URL='https://github-oidc.example/_token';

async function scenario(statuses,options={}){
 const oldFetch=globalThis.fetch;
 const oldEnv={
  DG_REPORT_READER:process.env.DG_REPORT_READER,
  ACTIONS_ID_TOKEN_REQUEST_URL:process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
  ACTIONS_ID_TOKEN_REQUEST_TOKEN:process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
 };
 process.env.DG_REPORT_READER='oidc';
 process.env.ACTIONS_ID_TOKEN_REQUEST_URL=TOKEN_URL;
 process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN='fixture-github-workflow-token';
 let edgeCalls=0,oidcCalls=0;
 const seen=[];
 globalThis.fetch=async(input,init={})=>{
  const url=String(input);
  seen.push({url,headers:init.headers||{}});
  if(url.startsWith(TOKEN_URL)){
   oidcCalls++;
   assert.match(url,/audience=dendrogeo-report-reader/);
   assert.equal(init.headers.Authorization,'Bearer fixture-github-workflow-token');
   return new Response(JSON.stringify({value:'oidc-fixture-'+oidcCalls}),{status:200});
  }
  if(url.startsWith('https://fixture.supabase.co/functions/v1/report-reader')){
   const status=statuses[Math.min(edgeCalls,statuses.length-1)];
   edgeCalls++;
   if(status==='throw')throw new Error('Network temporarily unavailable');
   return new Response(status===200?'[]':'{"error":"temporarily unavailable"}',{status});
  }
  throw new Error('unexpected network target '+url);
 };
 try{
  const module=await import('../scripts/lib/report-reader.mjs?scenario='+encodeURIComponent(options.id||statuses.join('-'))+'-'+Math.random());
  const response=await module.reportRead(new URL(PRIVATE_URL),{headers:{apikey:'anon-fixture'}});
  return{status:response.status,edgeCalls,oidcCalls,seen};
 }finally{
  globalThis.fetch=oldFetch;
  for(const [key,val] of Object.entries(oldEnv)){
   if(val===undefined)delete process.env[key];
   else process.env[key]=val;
  }
 }
}

test('report-reader retries a transient 503 just once and returns success without log queries',async()=>{
 const x=await scenario([503,200],{id:'temporary'});
 assert.equal(x.status,200);
 assert.equal(x.edgeCalls,2);
 assert.equal(x.oidcCalls,1);
 assert.ok(x.seen.every(q=>!q.url.includes('/logs')));
 assert.ok(x.seen.filter(q=>q.url.includes('/functions/')).every(q=>q.headers.apikey==='anon-fixture'));
});

test('report-reader requests a NEW OIDC token on one 401, never accepts persistent unauthorized',async()=>{
 const success=await scenario([401,200],{id:'refresh'});
 assert.equal(success.status,200);
 assert.equal(success.edgeCalls,2);
 assert.equal(success.oidcCalls,2);
 assert.notEqual(success.seen.filter(q=>q.url.includes('/functions/'))[0].headers.Authorization,
  success.seen.filter(q=>q.url.includes('/functions/'))[1].headers.Authorization);
 const denied=await scenario([401,401],{id:'denied'});
 assert.equal(denied.status,401);
 assert.equal(denied.edgeCalls,2);
 assert.equal(denied.oidcCalls,2);
});

test('report-reader never retries a permanent forbidden 403',async()=>{
 const x=await scenario([403],{id:'forbidden'});
 assert.equal(x.status,403);
 assert.equal(x.edgeCalls,1);
 assert.equal(x.oidcCalls,1);
});

test('persistent 503 stops after two attempts, preserving a detectable failure',async()=>{
 const x=await scenario([503,503],{id:'failed'});
 assert.equal(x.status,503);
 assert.equal(x.edgeCalls,2);
});

test('temporary network exception is retried once and only once',async()=>{
 const x=await scenario(['throw',200],{id:'network'});
 assert.equal(x.status,200);
 assert.equal(x.edgeCalls,2);
});
