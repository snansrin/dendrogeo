/* Named assertion-bearing test references are an inventory, not execution coverage. */
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
function walk(root,path){return readdirSync(join(root,path),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(root,path+'/'+entry.name):[path+'/'+entry.name]);}
export function collectModuleTestEvidence(root){
 const modules=walk(root,'src').filter(path=>path.endsWith('.js'));
 const tests=walk(root,'test').filter(path=>path.endsWith('.test.mjs')).map(path=>({path,source:readFileSync(join(root,path),'utf8')}));
 const rows=modules.map(module=>({module,tests:tests.filter(test=>test.source.includes(module)&&/\bassert(?:\.|\()/.test(test.source)).map(test=>test.path)}));
 return {rows,missing:rows.filter(row=>!row.tests.length).map(row=>row.module)};
}
export function validateEvidenceExceptions(missing,exceptions){
 const errors=[],allowed=new Map(exceptions.map(entry=>[entry.module,entry.reason]));
 if(allowed.size!==exceptions.length)errors.push('Duplicate evidence exception');
 for(const module of missing)if(!allowed.get(module)?.trim())errors.push('No named test evidence or documented exception: '+module);
 for(const entry of exceptions)if(!missing.includes(entry.module))errors.push('Stale evidence exception: '+entry.module);
 return errors;
}
