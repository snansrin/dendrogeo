// Aggregate ingestion. Request bodies never include account, IP, session or full referrer data.
import {resolveCountry} from './country-db.ts';
import {createIngestionBudget} from './ingestion-budget.js';
import {readBoundedText,PayloadTooLargeError} from './read-bounded-body.js';
const ingestionBudget=createIngestionBudget({onExceeded:()=>console.warn('[site-metrics] aggregate_budget_exceeded')});
const origins=new Set(['https://dendrogeo.org']);
const pages=new Set(['home','home-en','inventory','carbon','landcover','parks','methods','methods-en','data','reports','about','privacy','notice','terms','contact','app-dash','app-measure','app-nav','app-map','app-projects','app-records','app-export','app-world']);
const events=new Set(['page_view','workspace_open','analysis_request']);
const sources=new Set(['direct','search','ai','social','telegram','referral','internal']);
const devices=new Set(['phone','desktop','tablet']);
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin')||'',headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://dendrogeo.org','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS,GET','Vary':'Origin','Cache-Control':'no-store'};
 const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json'}});
 if(request.method==='OPTIONS')return new Response(null,{status:origins.has(origin)?204:403,headers});
 if(!origins.has(origin))return reply(403,{error:'Origin not allowed'});
 if(request.method==='GET')return reply(200,{status:'ok',schema:'site-metrics/v1',country:await resolveCountry(request)});
 if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
 if(request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1'||/bot|crawler|spider|headless|playwright/i.test(request.headers.get('user-agent')||''))return new Response(null,{status:204,headers});
 try{
  const raw=await readBoundedText(request,2048);
  const value=JSON.parse(raw);
  if(!events.has(value.event)||!pages.has(value.page)||!sources.has(value.source)||!devices.has(value.device)||Object.keys(value).some(key=>!['event','page','source','device'].includes(key)))return reply(400,{error:'Unsupported aggregate category'});
  if((value.event==='page_view'&&value.page.startsWith('app-'))||(value.event==='workspace_open'&&!value.page.startsWith('app-'))||(value.event==='analysis_request'&&value.page!=='app-map'))return reply(400,{error:'Invalid event scope'});
  if(!ingestionBudget.allow())return new Response(null,{status:204,headers});
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');
  if(!key||!url)return reply(503,{error:'Counter unavailable'});
  const response=await fetch(url+'/rest/v1/rpc/record_site_metric_v1',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_event:value.event,p_page:value.page,p_source:value.source,p_device:value.device,p_country:await resolveCountry(request)}),signal:AbortSignal.timeout(3000)});
  if(!response.ok)return reply(503,{error:'Counter unavailable'});
  return new Response(null,{status:204,headers});
 }catch(error){return error instanceof PayloadTooLargeError?reply(413,{error:'Payload too large'}):reply(400,{error:'Invalid request'});}
});
