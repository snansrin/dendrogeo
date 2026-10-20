import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

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

test('production scripts/workflows do not poll Supabase Logs Query APIs or embed a management token',()=>{
 const sources=[...scan(resolve(root,'.github/workflows')),...scan(resolve(root,'scripts')),
  ...scan(resolve(root,'src')),...scan(resolve(root,'supabase/functions')),
  ...scan(resolve(root,'assets')),...scan(resolve(root,'vendor')),
  resolve(root,'sw.js'),resolve(root,'index.html')];
 const suspicious=[];
 // Log ingestion by normal service traffic is different from expensive Logs
 // Query scans. No background browser, CI, or scheduled log scans are allowed.
 const banned=/(?:\bquery_logs\s*\(|\/analytics\/v1\/query\b|\/v1\/projects\/[^\s'"\x60]+\/analytics\/|management\.api\.supabase\.com[^\n]*logs\/)/i;
 for(const file of sources){
  const code=readFileSync(file,'utf8');
  if(banned.test(code))suspicious.push(file.slice(root.length));
 }
 assert.deepEqual(suspicious,[]);
});
