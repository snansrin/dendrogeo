/* User-authenticated inference proxy. No persistence, arbitrary hosts or model selection. */
export const MODEL_ID='tree-detection-fuytu/4';
const MAX_BODY=6*1024*1024;
export function createTreeDetectionHandler({env,fetch:request=globalThis.fetch,now=Date.now,report=()=>{}}){
 const users=new Map();
 return async function handle(req){
  const origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin==='https://dendrogeo.org')Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&origin!=='https://dendrogeo.org')return reply(403,{error:'origin_denied'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')||'';
  if(!/^Bearer \S+$/.test(bearer))return reply(401,{error:'sign_in_required'});
  const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY');
  let user;
  try{
   const auth=await request(url+'/auth/v1/user',{headers:{Authorization:bearer,apikey:anon},signal:AbortSignal.timeout(10000)});
   if(!auth.ok)return reply(401,{error:'sign_in_required'});
   user=await auth.json();
   if(!user.id||user.is_anonymous)return reply(401,{error:'sign_in_required'});
  }catch{return reply(503,{error:'auth_unavailable'});}
  const key=env('ROBOFLOW_API_KEY');
  if(!key)return reply(503,{error:'configuration_missing'});
  // Bounded per-isolate admission. Provider account quota remains the global spending limit.
  const time=now();
  for(const [id,value] of users)if(!value.busy&&time-value.since>60000)users.delete(id);
  const budget=users.get(user.id)||{since:time,count:0,busy:false};
  if(budget.busy||budget.count>=90||users.size>=1000)return reply(429,{error:'rate_limited'});
  users.set(user.id,budget);budget.busy=true;
  try{
   if(!req.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'invalid_image'});
   if(Number(req.headers.get('content-length'))>MAX_BODY)return reply(413,{error:'image_too_large'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_image'});
   const chunks=[];let size=0;
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();return reply(413,{error:'image_too_large'});}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,{error:'invalid_image'});}
   const {image,width,height,confidence}=body;
   if(typeof image!=='string'||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(image)||image.length<80||image.length%4!==0||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>2048||height>2048||!Number.isFinite(confidence)||confidence<0||confidence>1)return reply(400,{error:'invalid_image'});
   budget.count++;
   // Cloud v0 uses a model/version route and raw base64. The API key
   // stays in the Authorization header; never log upstream bodies.
   const provider=new URL('https://serverless.roboflow.com/'+MODEL_ID);
   provider.search=new URLSearchParams({confidence:String(Math.round(confidence*100)),overlap:'50',format:'json',disable_active_learning:'true'}).toString();
   let response;
   try{response=await request(provider.toString(),{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Bearer '+key},body:image,signal:AbortSignal.timeout(55000)});}catch(error){return reply(error.name==='TimeoutError'?504:502,{error:error.name==='TimeoutError'?'model_timeout':'model_unavailable'});}
   if(!response.ok){
    const status=response.status,error=[401,403].includes(status)?'model_access_denied':status===404?'model_not_found':[400,422].includes(status)?'model_request_rejected':[402,429].includes(status)?'provider_quota':'model_unavailable';
    report({stage:'roboflow',transport:'serverless-v0',model:MODEL_ID,status});
    return reply([402,429].includes(status)?429:502,{error,providerStatus:status});
   }
   let result=await response.json();if(Array.isArray(result)&&result.length===1)result=result[0];
   if(result?.image?.width!==width||result?.image?.height!==height||!Array.isArray(result.predictions)||result.predictions.length>5000)return reply(502,{error:'invalid_model_result'});
   const predictions=result.predictions.map(row=>({x:row.x,y:row.y,width:row.width,height:row.height,confidence:row.confidence,class:row.class}));
   if(predictions.some(row=>![row.x,row.y,row.width,row.height,row.confidence].every(Number.isFinite)||typeof row.class!=='string'||row.class.length>80))return reply(502,{error:'invalid_model_result'});
   return reply(200,{modelId:MODEL_ID,image:{width,height},predictions});
  }catch{return reply(502,{error:'model_unavailable'});}finally{budget.busy=false;}
 };
}
