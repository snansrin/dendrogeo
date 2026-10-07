export const AUDIENCE='dendrogeo-report-reader';
export const ISSUER='https://token.actions.githubusercontent.com';
const REPO='snansrin/dendrogeo';
const WORKFLOWS=new Set(['ci.yml','rapor-yayin.yml','rapor-kalp.yml','rapor.yml']);
export async function authorize(token,jwtVerify,jwks){
 const {payload}=await jwtVerify(token,jwks,{issuer:ISSUER,audience:AUDIENCE,algorithms:['RS256'],requiredClaims:['exp','iat','nbf','jti'],maxTokenAge:'10m',clockTolerance:5});
 if(payload.repository!==REPO||String(payload.repository_id)!=='1351563490'||String(payload.repository_owner_id)!=='262906823'||payload.ref!=='refs/heads/main'||!['push','schedule','workflow_dispatch','repository_dispatch'].includes(payload.event_name))throw Error('Unauthorized workflow');
 const allowed=[...WORKFLOWS].map(w=>`${REPO}/.github/workflows/${w}@refs/heads/main`);
 if(!allowed.includes(payload.workflow_ref))throw Error('Unauthorized workflow');
 return payload;
}
const COLUMNS={
 report_requests:new Set('id,park_id,with_lulc,status,note,created_at,surface_snapshot,requested_by'.split(',')),
 report_retractions:new Set('id,report_id,park_id,reason,status,requested_by,created_at'.split(',')),
 v_report_authors:new Set('created_at,park_id,kind,full_name,organization,user_id'.split(',')),
};
export function targetFor(input,base){
 const table=input.searchParams.get('resource');
 if(table==='rpc/dg_park_author'){
  const park=input.searchParams.get('park');
  if(!/^\d{1,12}$/.test(park||'')||[...input.searchParams.keys()].some(k=>!['resource','park'].includes(k)))throw Error('Invalid query');
  return new URL('/rest/v1/rpc/dg_park_author?park='+park,base);
 }
 if(!Object.hasOwn(COLUMNS,table||''))throw Error('Invalid resource');
 const target=new URL('/rest/v1/'+table,base);
 for(const [key,value] of input.searchParams){
  if(key==='resource')continue;
  if(key==='select'){
   if(!value||value.split(',').some(c=>!COLUMNS[table].has(c)))throw Error('Invalid selection');
  }else if(key==='status'){
   if(value!=='eq.Beklemede'||table==='v_report_authors')throw Error('Invalid status');
  }else if(key==='order'){
   if(!['created_at.asc','created_at.desc'].includes(value))throw Error('Invalid order');
  }else if(key==='limit'||key==='offset'){
   if(!/^\d+$/.test(value)||Number(value)>(key==='limit'?100:10000))throw Error('Invalid page');
  }else if(key==='park_id'){
   if(!/^eq\.\d{1,12}$/.test(value))throw Error('Invalid park');
  }else if(key==='created_at'){
   if(!value.startsWith('gte.')||!Number.isFinite(Date.parse(value.slice(4))))throw Error('Invalid cutoff');
  }else throw Error('Invalid filter');
  target.searchParams.set(key,value);
 }
 if(!target.searchParams.has('select'))target.searchParams.set('select',[...COLUMNS[table]].join(','));
 target.searchParams.set('limit',target.searchParams.get('limit')||'50');
 return target;
}
