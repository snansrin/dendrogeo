#!/usr/bin/env node
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

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

const presentationRules=[
  [/\.(?:innerHTML|textContent|classList)\b|\.style\s*\./,'DOM presentation belongs in ui'],
  [/\.(?:getElementById|querySelector(?:All)?|createElement|setAttribute|appendChild|scrollIntoView|focus|setStyle|fitBounds|setView|invalidateSize)\s*\(/,'DOM or map interaction belongs in ui'],
  [/\.(?:checked|disabled|value)\s*=(?!=)|\bevent\.(?:target|currentTarget|preventDefault|stopPropagation)\b/,'form/event interaction belongs in ui']
];
const domainRules=[
  ...presentationRules,
  [/\bDate\.now\s*\(|\bMath\.random\s*\(|\bnew\s+Date\s*\(\s*\)|\b(?:root|window|globalThis)\.crypto\b/,'clock/randomness must be an explicit domain input'],
  [/(?<![\w$.])(?:setTimeout|clearTimeout|setInterval|clearInterval)\s*\(|\bnew\s+AbortController\b/,'transport scheduling belongs outside domain'],
  [/(?<![\w$.])fetch\s*\(|\bwindow\.fetch\s*\(/,'global network access'],
  [/\b(?:document|navigator|localStorage|sessionStorage|indexedDB)\s*\./,'browser/platform state'],
  [/\b(?:sb|L)\s*\./,'Supabase or Leaflet access'],
  [/\bwindow\.DG_[A-Z0-9_]*(?:ADAPTER|APPLICATION|USE_CASE|UI)\b/,'dependency on another layer global']
];
const applicationRules=[
  ...presentationRules,
  [/\b(?:document|navigator|localStorage|sessionStorage|indexedDB)\s*\./,'browser/platform access must use a port'],
  [/(?<![\w$.])fetch\s*\(|\bwindow\.fetch\s*\(/,'global network access; inject it through a port'],
  [/\bsb\s*\./,'direct Supabase access; use an adapter'],
  [/\bL\s*\./,'direct Leaflet access; use a UI/adapter port'],
  [/\bwindow\.DG_[A-Z0-9_]*(?:ADAPTER|UI)\b/,'direct adapter/UI global access; inject a callback']
];

export function checkArchitecture(root=ROOT){
  const errors=[];let checked=0;
  for(const [layer,rules] of [['domain',domainRules],['application',applicationRules],['ui',[[/(?<![\w$.])fetch\s*\(|\bwindow\.fetch\s*\(/,'global network access; use an adapter port']]]]){
    const directory=join(root,'src',layer);
    for(const path of jsFiles(directory)){
      checked++;
      const source=readFileSync(path,'utf8');
      const relative=path.slice(root.length+1).replaceAll('\\','/');
      for(const [pattern,reason] of rules){
        const match=pattern.exec(source);
        if(match)errors.push(`${relative}: ${reason} (${match[0].trim()})`);
      }
    }
  }
  return{checked,errors};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=checkArchitecture();
  for(const error of result.errors)console.error(`🔴 ${error}`);
  if(result.errors.length){console.error(`🔴 Mimari sınırı başarısız (${result.errors.length} ihlal, ${result.checked} modül denetlendi).`);process.exitCode=1;}
  else console.log(`✅ Katman sınırları korundu (${result.checked} domain/application/ui modülü denetlendi).`);
}
