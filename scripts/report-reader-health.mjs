#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {reportRead} from './lib/report-reader.mjs';
const resource=process.argv[2];
if(!['report_requests','report_retractions'].includes(resource))throw Error('Invalid queue');
const config=readFileSync(new URL('../src/config/supabase.js',import.meta.url),'utf8');
const base=config.match(/SB_URL="([^"]+)"/)[1],key=config.match(/SB_KEY="([^"]+)"/)[1];
const url=new URL('/rest/v1/'+resource,base);
url.search=new URLSearchParams({status:'eq.Beklemede',select:resource==='report_requests'?'id':'id,report_id',limit:'100'}).toString();
const r=await reportRead(url,{headers:{apikey:key,Authorization:'Bearer '+key}});
if(!r.ok)throw Error('Queue reader failed: '+r.status);
console.log(JSON.stringify(await r.json()));
