#!/usr/bin/env node
import {readFileSync,readdirSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
export function findInlineEventAttributes(root=ROOT){
 const directory=join(root,'partials'),errors=[];
 const scan=(path,relativePath,source)=>{
  for(const match of source.matchAll(/\s(on(?:click|change|input|submit))\s*=/gi)){
   const line=source.slice(0,match.index).split('\n').length;
   errors.push(`${relativePath}:${line}: inline ${match[1]} handler must belong to a UI action module`);
  }
 };
 for(const name of readdirSync(directory).filter(name=>name.endsWith('.html')).sort()){
  const path=join(directory,name),source=readFileSync(path,'utf8');
  scan(path,relative(root,path).replaceAll('\\','/'),source);
 }
 for(const file of ['src/services/park-invites.js','src/ui/park-collaboration-panel.js','src/ui/park-invite-inbox.js','src/ui/park-invites-actions.js'])
  scan(join(root,file),file,readFileSync(join(root,file),'utf8'));
 return errors;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const errors=findInlineEventAttributes();for(const error of errors)console.error('🔴 '+error);
 if(errors.length)process.exitCode=1;else console.log('✅ HTML partials contain no inline event handlers.');
}
