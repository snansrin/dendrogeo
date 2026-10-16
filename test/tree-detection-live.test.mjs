import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createTreeDetectionHandler,MODEL_ID} from '../supabase/functions/tree-detection/handler.mjs';
const image='/9j/'+('A'.repeat(100));
const body={image,width:128,height:128,confidence:.5};
const env=name=>({SUPABASE_URL:'https://auth.test',SUPABASE_ANON_KEY:'public-key',ROBOFLOW_API_KEY:'server-only-secret'})[name];
const req=(data=body,extra={})=>new Request('https://edge.test',{method:'POST',headers:{Origin:'https://dendrogeo.org',Authorization:'Bearer user-session','Content-Type':'application/json',...extra},body:JSON.stringify(data)});
const predictions=[{x:50,y:50,width:20,height:20,confidence:.8,class:'Tree',secret:'omit'}];
test('proxy authenticates user, pins provider/model, uses header secret and sanitizes result',async()=>{
 const calls=[];const handle=createTreeDetectionHandler({env,fetch:async(url,options)=>{calls.push({url,options});return calls.length===1?Response.json({id:'user'}):Response.json({image:{width:128,height:128},predictions,api_key:'never expose'});}});
 const response=await handle(req());const result=await response.json();assert.equal(response.status,200);assert.equal(result.modelId,MODEL_ID);assert.equal(calls[1].url,'https://serverless.roboflow.com/infer/object_detection');assert.equal(calls[1].options.headers.Authorization,'Bearer server-only-secret');assert.equal(JSON.parse(calls[1].options.body).model_id,MODEL_ID);assert.equal(calls[0].options.headers.Authorization,'Bearer user-session');assert.equal(result.predictions[0].secret,undefined);assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://dendrogeo.org');
});
test('proxy refuses bad origin, signed-out, anonymous, invalid image and oversized input',async()=>{
 let calls=0;const handle=createTreeDetectionHandler({env,fetch:async()=>{calls++;return Response.json({id:'user'});}});
 assert.equal((await handle(req(body,{Origin:'https://evil.test'}))).status,403);assert.equal(calls,0);
 assert.equal((await handle(req(body,{Authorization:''}))).status,401);assert.equal(calls,0);
 assert.equal((await handle(req({...body,image:'https://arbitrary.test/secret'}))).status,400);assert.equal(calls,1);
 assert.equal((await handle(req({...body,width:2049}))).status,400);
 assert.equal((await handle(req(body,{'Content-Length':String(7*1024*1024)}))).status,413);
 const anon=createTreeDetectionHandler({env,fetch:async()=>Response.json({id:'anon',is_anonymous:true})});assert.equal((await anon(req())).status,401);
});
test('proxy returns safe configuration, quota, timeout and size mismatch errors',async()=>{
 for(const [upstream,status,error] of [[()=>new Response('secret upstream error',{status:429}),429,'provider_quota'],[()=>{throw new DOMException('secret','TimeoutError');},504,'model_timeout'],[()=>Response.json({image:{width:64,height:64},predictions}),502,'invalid_model_result']]){
  const handler=createTreeDetectionHandler({env,fetch:async url=>url.includes('/auth/')?Response.json({id:'user'}):upstream()});const response=await handler(req());assert.equal(response.status,status);assert.deepEqual(await response.json(),{error});
 }
 const handler=createTreeDetectionHandler({env:name=>name==='ROBOFLOW_API_KEY'?undefined:env(name),fetch:async()=>Response.json({id:'user'})});assert.equal((await handler(req())).status,503);
});
test('proxy refuses duplicate concurrent inference and limits calls',async()=>{
 let finish;const handler=createTreeDetectionHandler({env,fetch:async url=>url.includes('/auth/')?Response.json({id:'user'}):new Promise(resolve=>{finish=()=>resolve(Response.json({image:{width:128,height:128},predictions}));})});
 const first=handler(req());while(!finish)await new Promise(resolve=>setImmediate(resolve));assert.equal((await handler(req())).status,429);finish();assert.equal((await first).status,200);
});
