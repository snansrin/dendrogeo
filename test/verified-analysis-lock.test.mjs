import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,copyFileSync,appendFileSync,rmSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyAnalysisLock} from '../scripts/check-analysis-lock.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));

test('verified analysis lock rejects changed core code and altered manifest with nonzero CLI exit',()=>{
 assert.deepEqual(verifyAnalysisLock(),[]);
 const base=mkdtempSync(join(tmpdir(),'dg-analysis-lock-'));
 try{
  const manifest=JSON.parse(readFileSync(join(root,'docs/verified-analysis-lock.json'),'utf8'));
  for(const path of [...Object.keys(manifest.files),'docs/verified-analysis-lock.json','scripts/check-analysis-lock.mjs']){
   const target=join(base,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,path),target);
  }
  assert.deepEqual(verifyAnalysisLock(base),[]);
  appendFileSync(join(base,'src/ui/lc-sens.js'),'\n// accidental change\n');
  assert.match(verifyAnalysisLock(base).join('\n'),/src\/ui\/lc-sens\.js changed/);
  const cli=spawnSync(process.execPath,[join(base,'scripts/check-analysis-lock.mjs')],{encoding:'utf8'});
  assert.equal(cli.status,1);assert.match(cli.stderr,/VERIFIED ANALYSIS LOCK FAILED/);
  appendFileSync(join(base,'docs/verified-analysis-lock.json'),' ');
  assert.match(verifyAnalysisLock(base).join('\n'),/manifest changed/);
 }finally{rmSync(base,{recursive:true,force:true});}
});
