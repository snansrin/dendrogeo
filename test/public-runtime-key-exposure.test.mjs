import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
function scripts(path){return readdirSync(join(root,path),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?scripts(path+'/'+entry.name):entry.name.endsWith('.js')?[path+'/'+entry.name]:[]);}
test('public runtime artifacts contain no privileged Supabase JWT or secret-key literal',()=>{
 for(const path of ['index.html',...scripts('src')]){
  const text=readFileSync(join(root,path),'utf8');
  assert.equal(/sb_secret_[A-Za-z0-9_-]{20,}/.test(text),false,'Secret literal in '+path);
  for(const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
   let payload;try{payload=JSON.parse(Buffer.from(match[1],'base64url').toString());}catch{continue;}
   assert.notEqual(payload.role,'service_role','Privileged JWT in '+path);
  }
 }
});
