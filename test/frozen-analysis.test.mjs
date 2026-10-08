import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {frozenViolations} from '../scripts/check-frozen-analysis.mjs';
function fixture(){
 const repo=mkdtempSync(join(tmpdir(),'dg-freeze-'));
 const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
 const write=(path,text)=>{mkdirSync(join(repo,path,'..'),{recursive:true});writeFileSync(join(repo,path),text);};
 const commit=()=>{git('add','.');git('commit','-qm','fixture');return git('rev-parse','HEAD');};
 git('init','-q');git('config','user.name','QA');git('config','user.email','qa@example.test');
 write('src/ui/lc-sens.js','working scan and bars');write('docs/verified-analysis-lock.json',JSON.stringify({files:{'src/ui/lc-sens.js':'original'}}));
 const analysisRef=commit();write('AGENTS.md','no self unlock');write('scripts/check-frozen-analysis.mjs','trusted gate');write('.github/workflows/frozen-analysis.yml','trusted workflow');const baseRef=commit();
 return{repo,write,commit,analysisRef,baseRef,close:()=>rmSync(repo,{recursive:true,force:true})};
}
test('frozen gate rejects a source change even when the PR rewrites hashes and the checker',()=>{
 const f=fixture();try{f.write('src/ui/lc-sens.js','panel removed');f.write('docs/verified-analysis-lock.json',JSON.stringify({files:{}}));f.write('scripts/check-frozen-analysis.mjs','always succeed');
 const paths=frozenViolations({...f,headRef:f.commit()});assert.ok(paths.includes('src/ui/lc-sens.js'));assert.ok(paths.includes('docs/verified-analysis-lock.json'));assert.ok(paths.includes('scripts/check-frozen-analysis.mjs'));
 }finally{f.close();}
});
test('frozen gate rejects workflow deletion and attempts to relax agent instructions',()=>{
 const f=fixture();try{rmSync(join(f.repo,'.github/workflows/frozen-analysis.yml'));f.write('AGENTS.md','unlock on any defect');const paths=frozenViolations({...f,headRef:f.commit()});assert.deepEqual(paths,['.github/workflows/frozen-analysis.yml','AGENTS.md']);}finally{f.close();}
});
test('frozen gate permits report content without modifying app or lock controls',()=>{
 const f=fixture();try{f.write('rapor/DGR-2026-0001/index.html','report content');assert.deepEqual(frozenViolations({...f,headRef:f.commit()}),[]);}finally{f.close();}
});
