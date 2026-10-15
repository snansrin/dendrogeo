#!/usr/bin/env node
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseJavaScript,walkAst,memberPath,calledPath} from './lib/javascript-ast.mjs';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
function* jsFiles(directory){
  if(!statSync(directory,{throwIfNoEntry:false})?.isDirectory())return;
  for(const name of readdirSync(directory)){
    if(name.startsWith('.'))continue;
    const path=join(directory,name),info=statSync(path);
    if(info.isDirectory())yield* jsFiles(path);
    else if(name.endsWith('.js'))yield path;
  }
}

const presentationProperties=new Set(['innerHTML','textContent','classList','style']);
const domMethods=new Set(['getElementById','querySelector','querySelectorAll','createElement','setAttribute','appendChild','scrollIntoView','focus','setStyle','fitBounds','setView','invalidateSize']);
const formProperties=new Set(['checked','disabled','value']);
const platformRoots=new Set(['document','navigator','localStorage','sessionStorage','indexedDB']);
function violationsFor(ast,layer){
  const found=new Map();
  const add=(reason,node)=>{if(!found.has(reason))found.set(reason,node);};
  walkAst(ast,node=>{
    const path=memberPath(node),parts=path?.split('.'),last=parts?.at(-1),call=calledPath(node),callLast=call?.split('.').at(-1);
    const inward=layer==='domain'||layer==='application';
    if(inward&&path&&presentationProperties.has(last))add('DOM presentation belongs in ui',node);
    if(inward&&node.type==='CallExpression'&&domMethods.has(callLast))add('DOM or map interaction belongs in ui',node);
    if(inward&&path&&['event','e'].includes(parts[0])&&parts.some(part=>part==='target'||part==='currentTarget'))add('form/event interaction belongs in ui',node);
    if(inward&&node.type==='CallExpression'&&['event.preventDefault','event.stopPropagation','e.preventDefault','e.stopPropagation'].includes(call))add('form/event interaction belongs in ui',node);
    if(inward&&node.type==='AssignmentExpression'&&memberPath(node.left)?.split('.').some(part=>formProperties.has(part)))add('form/event interaction belongs in ui',node);
    if(layer==='domain'){
      if(node.type==='CallExpression'&&['Date.now','Math.random'].includes(call))add('clock/randomness must be an explicit domain input',node);
      if(node.type==='NewExpression'&&call==='Date'&&node.arguments.length===0)add('clock/randomness must be an explicit domain input',node);
      if(path&&['window.crypto','root.crypto','globalThis.crypto'].includes(path))add('clock/randomness must be an explicit domain input',node);
      if(node.type==='CallExpression'&&['setTimeout','clearTimeout','setInterval','clearInterval'].includes(call))add('transport scheduling belongs outside domain',node);
      if(node.type==='NewExpression'&&call==='AbortController')add('transport scheduling belongs outside domain',node);
      if(node.type==='CallExpression'&&['fetch','window.fetch'].includes(call))add('global network access',node);
      if(node.type==='MemberExpression'&&path&&platformRoots.has(parts[0]))add('browser/platform state',node);
      if(node.type==='MemberExpression'&&path&&['sb','L'].includes(parts[0]))add('Supabase or Leaflet access',node);
      if(path&&/^(?:window|root|globalThis)\.DG_[A-Z0-9_]*(?:ADAPTER|APPLICATION|USE_CASE|UI)(?:\.|$)/.test(path))add('dependency on another layer global',node);
    }
    if(layer==='application'){
      if(node.type==='MemberExpression'&&path&&platformRoots.has(parts[0]))add('browser/platform access must use a port',node);
      if(node.type==='CallExpression'&&['fetch','window.fetch'].includes(call))add('global network access; inject it through a port',node);
      if(node.type==='MemberExpression'&&path&&parts[0]==='sb')add('direct Supabase access; use an adapter',node);
      if(node.type==='MemberExpression'&&path&&parts[0]==='L')add('direct Leaflet access; use a UI/adapter port',node);
      if(path&&/^(?:window|root|globalThis)\.DG_[A-Z0-9_]*(?:ADAPTER|UI)(?:\.|$)/.test(path))add('direct adapter/UI global access; inject a callback',node);
    }
    if(layer==='ui'&&node.type==='CallExpression'&&['fetch','window.fetch'].includes(call))add('global network access; use an adapter port',node);
  });
  return [...found].map(([reason,node])=>({reason,line:node.loc?.start.line||1,excerpt:node.type}));
}

export function checkArchitecture(root=ROOT){
  const errors=[];let checked=0;
  for(const layer of ['domain','application','ui']){
    for(const path of jsFiles(join(root,'src',layer))){
      checked++;
      const relative=path.slice(root.length+1).replaceAll('\\','/');
      let ast;
      try{ast=parseJavaScript(readFileSync(path,'utf8'),{filename:relative});}
      catch(error){errors.push(`${relative}:${error.loc?.line||1}: JavaScript AST ayrıştırılamadı (${error.message})`);continue;}
      for(const violation of violationsFor(ast,layer))errors.push(`${relative}:${violation.line}: ${violation.reason} (${violation.excerpt})`);
    }
  }
  return{checked,errors};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=checkArchitecture();
  for(const error of result.errors)console.error(`🔴 ${error}`);
  if(result.errors.length){console.error(`🔴 Mimari sınırı başarısız (${result.errors.length} ihlal, ${result.checked} modül denetlendi).`);process.exitCode=1;}
  else console.log(`✅ AST katman sınırları korundu (${result.checked} domain/application/ui modülü denetlendi).`);
}
