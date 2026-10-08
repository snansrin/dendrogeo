import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Fixed production r90 snapshot. Never derive this from the candidate PR.
export const FROZEN_R90='f58deb7f936263d8ae3eb3e14328a494684d1de0';
const git=(repo,args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'});
const changed=(repo,left,right)=>git(repo,['diff','--name-only','-z',left,right,'--']).split('\0').filter(Boolean);
const sourcePath=p=>/^(src\/|css\/|vendor\/|partials\/|supabase\/functions\/planetary-sas\/)/.test(p)||['index.html','sw.js','manifest.json','release-version.json','package.json','package-lock.json'].includes(p);
const controlPath=p=>p==='AGENTS.md'||p==='test/frozen-analysis.test.mjs'||p.startsWith('.github/workflows/')||p.startsWith('scripts/')||p==='docs/verified-analysis-lock.json'||p==='docs/VERIFIED-ANALYSIS-LOCK.md';
export function frozenViolations({repo,baseRef,headRef,analysisRef=FROZEN_R90}){
 for(const ref of [baseRef,headRef,analysisRef])if(!/^[a-f0-9]{40}$/.test(ref))throw Error('Exact commit SHA required');
 const manifest=JSON.parse(git(repo,['show',analysisRef+':docs/verified-analysis-lock.json']));
 const protectedFiles=new Set(Object.keys(manifest.files));
 const source=changed(repo,analysisRef,headRef).filter(p=>sourcePath(p)||protectedFiles.has(p));
 // Run this script from the trusted PR base. Updating hashes, the guard,
 // instructions or workflow in the same PR cannot authorize a source change.
 const controls=changed(repo,baseRef,headRef).filter(controlPath);
 return [...new Set([...source,...controls])].sort();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const repo=process.cwd(),[baseRef,headRef]=process.argv.slice(2);
 const violations=frozenViolations({repo,baseRef,headRef});
 if(violations.length){console.error('FROZEN R90 ANALYSIS: changes blocked\n'+violations.join('\n')+'\nDo not regenerate hashes or update the guard. A defect report is not permission to unlock.');process.exitCode=1;}
 else console.log('Frozen r90 analysis and trusted-base lock controls unchanged.');
}
