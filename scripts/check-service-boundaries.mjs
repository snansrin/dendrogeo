#!/usr/bin/env node
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const BASELINE_PATH='docs/legacy-service-boundaries.json';
const RULES={
  dom:/\b(?:document|window\s*\.\s*document)\s*\.\s*(?:getElementById|querySelector(?:All)?|createElement|addEventListener|removeEventListener|appendChild|setAttribute)\s*\(|\.(?:innerHTML|textContent|classList)\b|\.style\s*\./g,
  persistence:/\b(?:sb|client|supabase|supabaseClient)\s*\.\s*(?:from|channel|rpc)\s*\(|\b(?:sb|client|supabase|supabaseClient)\s*\.\s*(?:auth|storage|realtime|functions)\s*\./g,
  network:/(?<![\w$.])fetch\s*\(|\bwindow\s*\.\s*fetch\s*\(/g
};

function* javascriptFiles(directory){
  if(!statSync(directory,{throwIfNoEntry:false})?.isDirectory())return;
  for(const name of readdirSync(directory).sort()){
    if(name.startsWith('.'))continue;
    const path=join(directory,name),info=statSync(path);
    if(info.isDirectory())yield*javascriptFiles(path);
    else if(name.endsWith('.js'))yield path;
  }
}

export function scanServiceBoundaryDebt(root){
  const files={};
  for(const path of javascriptFiles(join(root,'src/services'))){
    const source=readFileSync(path,'utf8'),relativePath=relative(root,path).replaceAll('\\','/');
    const counts={};
    for(const [category,pattern] of Object.entries(RULES))counts[category]=[...source.matchAll(pattern)].length;
    files[relativePath]=counts;
  }
  return files;
}

export function compareServiceBoundaryDebt(current,baseline){
  const errors=[];
  if(!baseline||baseline.schema!=='dendrogeo/legacy-service-boundaries/v1'||!baseline.files||typeof baseline.files!=='object'){
    return{errors:['Legacy service sınır tabanı tanınmıyor.'],introduced:0};
  }
  let introduced=0;
  for(const path of Object.keys(baseline.files)){
    if(!Object.hasOwn(current,path))errors.push(`${path}: baseline service is missing`);
  }
  for(const [path,counts] of Object.entries(current)){
    const previous=baseline.files[path]||{};
    for(const category of Object.keys(RULES)){
      const now=counts[category]||0,allowed=previous[category]||0;
      if(now>allowed){introduced+=now-allowed;errors.push(`${path}: ${category} sınır borcu ${allowed} → ${now} arttı`);}
    }
  }
  return{errors,introduced};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  let baseline;
  try{baseline=JSON.parse(readFileSync(join(ROOT,BASELINE_PATH),'utf8'));}
  catch(error){console.error(`🔴 ${BASELINE_PATH} okunamadı: ${error.message}`);process.exitCode=1;}
  if(baseline){
    const current=scanServiceBoundaryDebt(ROOT),result=compareServiceBoundaryDebt(current,baseline);
    for(const error of result.errors)console.error(`🔴 ${error}`);
    const total=Object.values(current).reduce((sum,counts)=>sum+Object.values(counts).reduce((n,value)=>n+value,0),0);
    if(result.errors.length){console.error(`🔴 Legacy servis sınır kapısı başarısız (${result.introduced} yeni erişim).`);process.exitCode=1;}
    else console.log(`✅ Legacy servis sınır borcu artmadı (${total} mevcut erişim; azaltımlar kabul edilir).`);
  }
}
