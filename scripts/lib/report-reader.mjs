// Private publication data is read by a short-lived, repository-bound OIDC
// identity. No Supabase privileged credential is sent to GitHub or the browser.
export const PRIVATE_REPORT_RESOURCES=new Set(['report_requests','report_retractions','v_report_authors','rpc/dg_park_author']);
const AUDIENCE='dendrogeo-report-reader';
let cached=null;
async function oidcToken(){
 if(cached&&cached.expires>Date.now()+60000)return cached.value;
 const endpoint=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,credential=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 if(!endpoint||!credential)throw Error('GitHub OIDC identity unavailable');
 const url=new URL(endpoint);url.searchParams.set('audience',AUDIENCE);
 const r=await fetch(url,{headers:{Authorization:'Bearer '+credential},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('GitHub OIDC identity request failed: '+r.status);
 const data=await r.json();if(typeof data.value!=='string'||!data.value)throw Error('GitHub OIDC identity missing');
 // Cache for two minutes, less than GitHub token lifetime. Never log JWTs.
 cached={value:data.value,expires:Date.now()+120000};return data.value;
}
export async function reportRead(url,options){
 const input=new URL(url),resource=input.pathname.split('/rest/v1/')[1];
 if(process.env.DG_REPORT_READER!=='oidc'||!PRIVATE_REPORT_RESOURCES.has(resource))return fetch(url,options);
 const target=new URL('/functions/v1/report-reader',input.origin);
 target.search=input.search;target.searchParams.set('resource',resource);
 const token=await oidcToken();
 return fetch(target,{method:'GET',headers:{Authorization:'Bearer '+token,apikey:options?.headers?.apikey||'',Accept:'application/json'},signal:AbortSignal.timeout(30000)});
}
