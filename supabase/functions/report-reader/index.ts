import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
import {authorize,targetFor,ISSUER} from './policy.mjs';
const jwks=createRemoteJWKSet(new URL(ISSUER+'/.well-known/jwks'),{timeoutDuration:10000,cooldownDuration:30000,cacheMaxAge:300000});
const json=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async (req:Request)=>{
 if(req.method!=='GET')return json(405,'GET required');
 const token=req.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
 if(!token)return json(401,'Authentication required');
 try{await authorize(token,jwtVerify,jwks);}catch{return json(401,'Workflow authentication failed');}
 let target:URL;
 try{target=targetFor(new URL(req.url),Deno.env.get('SUPABASE_URL'));}catch{return json(400,'Invalid read query');}
 try{
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!key)return json(503,'Reader unavailable');
  const response=await fetch(target,{method:'GET',headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)return json(502,'Database read failed');
  return new Response(await response.text(),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch{return json(503,'Database read unavailable');}
});
