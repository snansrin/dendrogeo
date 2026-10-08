const ALLOWED_ORIGINS=new Set(['https://dendrogeo.org','https://www.dendrogeo.org']);
const UPSTREAM='https://planetarycomputer.microsoft.com/api/sas/v1/token/esa-worldcover';
export function createTokenHandler({fetchImpl=fetch,now=Date.now}={}){
 let cached=null,pending=null;
 return async request=>{
  const origin=request.headers.get('Origin');
  const cors={'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGINS.has(origin)?origin:'https://dendrogeo.org','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json'};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
  if(origin&&!ALLOWED_ORIGINS.has(origin))return new Response('Origin denied',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='GET')return reply({error:'Method not allowed'},405);
  const url=new URL(request.url);
  if((url.searchParams.get('collection')||'esa-worldcover')!=='esa-worldcover'||[...url.searchParams.keys()].some(k=>k!=='collection'))return reply({error:'Only ESA WorldCover signing is supported'},400);
  try{
   if(cached&&cached.expires>now()+120000)return reply(cached.data);
   if(!pending)pending=(async()=>{
    const response=await fetchImpl(UPSTREAM,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000),cache:'no-store',redirect:'error'});
    if(!response.ok){await response.body?.cancel();throw Error('Upstream signing unavailable');}
    const data=await response.json(),expires=Date.parse(data.msftExpiry||new URLSearchParams(data.token||'').get('se'));
    if(typeof data.token!=='string'||!data.token||!Number.isFinite(expires)||expires<=now()+120000)throw Error('Invalid signing response');
    cached={data:{token:data.token,msftExpiry:new Date(expires).toISOString()},expires};return cached.data;
   })().finally(()=>pending=null);
   return reply(await pending);
  }catch{return reply({error:'WorldCover signing is temporarily unavailable; no raster result was produced'},502);}
 };
}
