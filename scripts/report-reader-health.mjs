#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {reportRead} from './lib/report-reader.mjs';
const resource=process.argv[2];
if(!['report_requests','report_retractions','--verify'].includes(resource))throw Error('Invalid queue');
const config=readFileSync(new URL('../src/config/supabase.js',import.meta.url),'utf8');
const base=config.match(/SB_URL="([^"]+)"/)[1],key=config.match(/SB_KEY="([^"]+)"/)[1];
if(resource==='--verify'){
 const targets=[['report_requests',{select:'id',limit:'1'}],['report_retractions',{select:'id',limit:'1'}],['v_report_authors',{select:'park_id',limit:'1'}]];
 let park=null;
 for(const [table,params] of targets){
  const url=new URL('/rest/v1/'+table,base);url.search=new URLSearchParams(params).toString();
  const r=await reportRead(url,{headers:{apikey:key,Authorization:'Bearer '+key}});
  if(!r.ok)throw Error('Authenticated reader failed: '+table+' '+r.status);
  const rows=await r.json();if(!Array.isArray(rows))throw Error('Invalid reader response');
  if(table==='v_report_authors')park=rows[0]?.park_id;
  console.log(JSON.stringify({resource:table,ok:true,rows:rows.length}));
 }
 if(park){
  const r=await reportRead(new URL('/rest/v1/rpc/dg_park_author?park='+park,base),{headers:{apikey:key,Authorization:'Bearer '+key}});
  if(!r.ok||!Array.isArray(await r.json()))throw Error('Authenticated author reader failed');
  console.log(JSON.stringify({resource:'rpc/dg_park_author',ok:true}));
 }
 process.exit(0);
}
const url=new URL('/rest/v1/'+resource,base);
url.search=new URLSearchParams({status:'eq.Beklemede',select:resource==='report_requests'?'id':'id,report_id',limit:'100'}).toString();
const r=await reportRead(url,{headers:{apikey:key,Authorization:'Bearer '+key}});
if(!r.ok)throw Error('Queue reader failed: '+r.status);
console.log(JSON.stringify(await r.json()));
