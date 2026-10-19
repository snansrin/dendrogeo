import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createIngestionBudget} from '../supabase/functions/site-metrics/ingestion-budget.js';
test('worker budget is bounded, expires and emits at most one anonymous warning per window',()=>{
 let now=0,warnings=0;const budget=createIngestionBudget({limit:2,windowMs:10,clock:()=>now,onExceeded:()=>warnings++});
 assert.equal(budget.allow(),true);assert.equal(budget.allow(),true);assert.equal(budget.allow(),false);assert.equal(budget.allow(),false);assert.equal(warnings,1);
 now=10;assert.equal(budget.allow(),true);assert.equal(budget.allow(),true);assert.equal(budget.allow(),false);assert.equal(warnings,2);
 now=1;assert.equal(budget.allow(),true);
});
test('ingestion rejects invalid categories before writes and sheds excess metrics without changing application records',async()=>{
 let handler,writes=0,warnings=0;const payloads=[];
 const source=readFileSync(new URL('../supabase/functions/site-metrics/index.ts',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replaceAll(':Request','').replaceAll(':number','').replaceAll(':unknown','');
 vm.runInNewContext(source,{createIngestionBudget,resolveCountry:async()=> 'TR',Request,Response,AbortSignal,
  console:{warn(){warnings++;}},Deno:{serve(fn){handler=fn;},env:{get(name){return name==='SUPABASE_URL'?'https://example.invalid':'fixture-key';}}},
  fetch:async(url,options)=>{assert.equal(url,'https://example.invalid/rest/v1/rpc/record_site_metric_v1');writes++;payloads.push(JSON.parse(options.body));return new Response(null,{status:204});}});
 const request=value=>new Request('https://example.invalid/site-metrics',{method:'POST',headers:{origin:'https://dendrogeo.org','content-type':'application/json'},body:JSON.stringify(value)});
 const value={event:'page_view',page:'home',source:'direct',device:'phone'};
 assert.equal((await handler(request({...value,private_id:'forbidden'}))).status,400);assert.equal(writes,0);
 for(let i=0;i<605;i++)assert.equal((await handler(request(value))).status,204);
 assert.equal(writes,600);assert.equal(warnings,1);assert.equal(Object.keys(payloads[0]).sort().join(','),'p_country,p_device,p_event,p_page,p_source');
 const health=await handler(new Request('https://example.invalid/site-metrics',{headers:{origin:'https://dendrogeo.org'}}));assert.equal(health.status,200);assert.equal(writes,600);
});
