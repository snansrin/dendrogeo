import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {saveQueue} from '../scripts/lib/report-queue-store.mjs';
import {createRetractionNotice} from '../scripts/lib/report-retraction.mjs';
import {createReportQueueRunner} from '../scripts/lib/report-queue-runner.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const exists=path=>existsSync(new URL('../'+path,import.meta.url));

test('no retired Oracle probe, independent complete-backup page or orphaned public JavaScript remains',()=>{
 for(const directory of ['fotografli-tam-veri-arsivi','tam-yedek','oracle-storage-check']){
  assert.equal(exists(directory),false,'Retired public entry and code must be removed: '+directory);
 }
 // Retired Oracle transport must not survive as a runnable artifact.
 for(const path of [
  'supabase/functions/oracle-storage-probe/storage.mjs',
  'supabase/functions/oracle-storage-probe/deno.json',
  'test/oracle-storage-probe.test.mjs',
  'test/oracle-storage-probe-fail-closed.test.mjs'
 ])assert.equal(exists(path),false,'Obsolete Oracle staging transport remains: '+path);
 assert.match(read('src/application/backup/photo-full-workflow.mjs'),/client\.auth\.getUser\(\)/);
 assert.match(read('src/application/backup/photo-full-workflow.mjs'),/profile\.data\?\.role!=='owner'/);
 assert.match(read('src/ui/photo-admin-controls.mjs'),/PROFILE\?\.role!=='owner'/);
 assert.doesNotMatch(read('README.md'),/https:\/\/dendrogeo\.org\/(?:fotografli-tam-veri-arsivi|tam-yedek|oracle-storage-check)\//);
});

test('retired Oracle Edge probe cannot request secrets, storage, or outbound networks',()=>{
 const handler=read('supabase/functions/oracle-storage-probe/index.ts');
 assert.match(handler,/Oracle staging probe disabled/);
 assert.doesNotMatch(handler,/\bfetch\s*\(|Deno\.env|import\s|AwsClient|probeStorage/);
});

function scan(directory,result=[]){
 if(!existsSync(directory))return result;
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const path=resolve(directory,entry.name);
  if(entry.isDirectory()){if(!['node_modules','.git'].includes(entry.name))scan(path,result);}
  else if(/\.(?:[cm]?js|ts|yml|yaml)$/.test(entry.name))result.push(path);
 }
 return result;
}

const LOG_READ_PATTERN=/(?:query_logs\s*\(|get_logs\s*\(|\/analytics\/v1\/query\b|\/v1\/projects\/[^\s'"\x60]+\/(?:analytics|logs)\/|management\.api\.supabase\.com[^\n]*logs\/|(?:["'\x60\n;&|]|\brun:)[ \t]*supabase[ \t]+(?:functions[ \t]+)?logs\b)/i;

test('log guard recognizes the actual namespaced MCP calls and CLI reads, not ordinary log comments',()=>{
 for(const code of [
  'tools.mcp__codex_apps__supabase_query_logs({project_id:"example",sql:"select source,count() from logs group by source"})',
  'tools.mcp__supabase__get_logs({project_id:"example",service:"edge-function"})',
  'run: supabase functions logs example',
  'fetch("https://api.supabase.com/v1/projects/example/analytics/endpoints/logs.all")',
  'fetch("https://api.supabase.com/v1/projects/example/logs/query")'
 ])assert.match(code,LOG_READ_PATTERN,'Expensive log reader bypasses the guard');
 assert.doesNotMatch('// Avoid repeatedly scanning Supabase logs.',LOG_READ_PATTERN);
 assert.doesNotMatch('client.from("measurements").select("id")',LOG_READ_PATTERN);
});

test('production scripts/workflows do not poll Supabase Logs Query APIs or embed a management token',()=>{
 const sources=[...scan(resolve(root,'.github/workflows')),...scan(resolve(root,'scripts')),
  ...scan(resolve(root,'src')),...scan(resolve(root,'supabase/functions')),
  ...scan(resolve(root,'assets')),...scan(resolve(root,'vendor')),
  resolve(root,'sw.js'),resolve(root,'index.html')];
 const suspicious=[];
 // Log ingestion by normal service traffic is different from expensive Logs
 // Query scans. No background browser, CI, or scheduled log scans are allowed.
 for(const file of sources){
  const code=readFileSync(file,'utf8');
  if(LOG_READ_PATTERN.test(code))suspicious.push(file.slice(root.length));
 }
 assert.deepEqual(suspicious,[]);
});

test('agent instructions prohibit quota-consuming log investigations without a specific user request',()=>{
 const policy=read('AGENTS.md');
 assert.match(policy,/Logs Query[\s\S]*YASAKTIR/);
 assert.match(policy,/genel "kontrol et\/düzelt" talebi günlük taramasına izin sayılmaz/);
 assert.match(policy,/kesin zaman aralığı ve sorgu sayısı/);
 assert.match(policy,/teknik bir kota kesicisi[\s\S]*değildir/);
});

test('public report queue and withdrawal tombstones exclude requester identity and free-text reason',()=>{
 const queue=JSON.parse(read('rapor/yayin-kuyrugu.json'));
 for(const entry of queue.entries){
  if(!entry.retraction_id)continue;
  for(const key of ['requested_by','requested_at','reason'])
   assert.equal(Object.hasOwn(entry,key),false,`public queue entry must omit ${key}`);
  if(entry.status==='Geri çekildi'){
   const notice=read(`rapor/${entry.report_id}/index.html`);
   assert.doesNotMatch(notice,/Gerekçe|yayin-kuyrugu\.json|istek sahibinin|özel not/i);
  }
 }
});

test('public queue persistence strips private retraction fields and production notice hides the reason',()=>{
 const path=resolve(mkdtempSync(resolve(tmpdir(),'dg-public-queue-')),'queue.json');
 const serialized=JSON.stringify(saveQueue({entries:[{
  retraction_id:'ret-1',report_id:'DGR-2026-0001',status:'Geri çekildi',requested_by:'private-user',
  requested_at:'private-time',reason:'private-reason'
 }]},path));
 assert.doesNotMatch(serialized,/private-user|private-time|private-reason|requested_by|requested_at|"reason"/);
 const render=createRetractionNotice({siteOrigin:'https://dendrogeo.org',reportTitle:'Rapor'});
 const notice=render({id:'DGR-2026-0001',parkName:'Park',reason:'private-reason',publicSafe:true});
 assert.doesNotMatch(notice,/private-reason|Gerekçe|yayin-kuyrugu\.json/);
 assert.match(notice,/isteği gönderen hesaba ait ayrıntılar yayımlanmaz/);
});

test('production withdrawal runner never forwards the database reason to the public renderer',async()=>{
 let received;
 const queue={entries:[{report_id:'DGR-2026-0001',status:'Yayınlandı',park_id:5}],processed_retraction_ids:[]};
 const run=createReportQueueRunner({
  RUN_LIMIT:2,QUEUE_PATH:'queue.json',loadQueue:()=>structuredClone(queue),saveQueue:()=>{},
  effectiveProcessedRequestIds:()=>[],fetchPending:async()=>[],
  fetchPendingRetractions:async()=>({rows:[{id:'ret-1',report_id:'DGR-2026-0001',park_id:5,reason:'private-reason',requested_by:'private-user',created_at:'private-time'}],missing:false}),
  planQueue:()=>({already:0,todo:[],skipped:0}),planRetractions:()=>({todo:[{id:'ret-1',report_id:'DGR-2026-0001',park_id:5,reason:'private-reason',requested_by:'private-user',created_at:'private-time'}],invalid:[]}),
  handle:()=>{},handleRetraction:(rt)=>{received=rt;return{report_id:rt.report_id,status:'Geri çekildi'};},log:()=>{}
 });
 await run();
 assert.equal(received.reason,'');
 assert.equal(received.public_safe,true);
 assert.equal(received.requested_by,'private-user');
});
