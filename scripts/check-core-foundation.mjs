#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const MANIFEST_PATH=join(ROOT,'docs/core-foundation-lock.json');
const MANIFEST_SHA256="23e4e1fca2717cb430f5331c9e9912ac6f6972f5309e1a6cb50f647c8c4036fb";
const EXPECTED_BASELINE='867c7566645b43cf7a5a7caf56bac6c44c39ef79';
const EXPECTED_POLICY='FROZEN_EXISTING_FILES_ADD_ONLY';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function verifyCoreFoundation(root=ROOT){
  const errors=[];
  let manifest;
  let raw;
  try{
    raw=readFileSync(join(root,'docs/core-foundation-lock.json'));
    manifest=JSON.parse(raw.toString('utf8'));
  }catch(error){
    return {checked:0,errors:[`Çekirdek kilit manifesti okunamadı: ${error.message}`]};
  }
  const actualManifestHash=hash(raw);
  if(actualManifestHash!==MANIFEST_SHA256){
    errors.push(`Kilit manifesti değişmiş: beklenen ${MANIFEST_SHA256}, bulunan ${actualManifestHash}`);
  }
  if(manifest.baseline_commit!==EXPECTED_BASELINE)errors.push('Kilit temel commit’i değişmiş.');
  if(manifest.policy!==EXPECTED_POLICY)errors.push('Çekirdek kilit politikası değişmiş.');
  if(manifest.schema!=='dendrogeo/immutable-core-foundation/v1')errors.push('Çekirdek kilit şeması tanınmıyor.');

  const files=manifest.sha256||{};
  const categoryFiles=new Set(Object.values(manifest.categories||{}).flat());
  for(const path of Object.keys(files))if(!categoryFiles.has(path))errors.push(`Kategoriye bağlı olmayan kilit dosyası: ${path}`);
  for(const path of categoryFiles)if(!Object.hasOwn(files,path))errors.push(`Hash’i olmayan çekirdek dosyası: ${path}`);
  const authorizedHashes=new Map();
  for(const migration of manifest.authorized_modularizations||[]){
    const migrationFiles=Array.isArray(migration?.files)?migration.files:[];
    if(!migration||(!migration.scope&&!migration.request)||!migration.date||(!Array.isArray(migration.files)&&!Array.isArray(migration.added_protected_files))){errors.push('Yetkili modüler geçiş kaydı eksik alan içeriyor.');continue;}
    for(const file of migrationFiles){
      const {path,previous_sha256,sha256}=file||{};
      if(!path){errors.push('Yetkili geçiş dosya yolu eksik.');continue;}
      if(!Object.hasOwn(files,path)){
        if(migration.audit_chain==='sha256-v1')errors.push(`Yetkili geçiş çekirdek kilidi dışındaki yolu içeriyor: ${path}`);
        continue;
      }
      // The pinned manifest digest preserves historical records, whose chain
      // formats predate this validator. New records opt into strict chaining.
      if(migration.audit_chain==='sha256-v1'){
        const previous=authorizedHashes.get(path)||files[path];
        if(previous_sha256!==previous)errors.push(`Yetkili geçiş zinciri kırık: ${path} önceki SHA eşleşmiyor.`);
      }
      if(!/^[a-f0-9]{64}$/.test(sha256||''))errors.push(`Yetkili geçiş SHA biçimi geçersiz: ${path}`);
      else authorizedHashes.set(path,sha256);
    }
  }
  for(const [path,expected] of Object.entries(files)){
    try{
      const actual=hash(readFileSync(join(root,path)));
      const approved=authorizedHashes.get(path)||expected;
      if(actual!==approved)errors.push(`${path} değişmiş (beklenen ${approved}, bulunan ${actual})`);
    }catch(error){
      errors.push(`${path} okunamadı: ${error.message}`);
    }
  }
  return {checked:Object.keys(files).length,errors};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyCoreFoundation();
  for(const error of result.errors)console.error('🔴 '+error);
  if(result.errors.length){
    console.error(`🔴 Çekirdek kilidi başarısız (${result.errors.length} sorun, ${result.checked} dosya denetlendi).`);
    process.exitCode=1;
  }else{
    console.log(`✅ Değişmez çekirdek doğrulandı (${result.checked} dosya; baseline ${EXPECTED_BASELINE}).`);
  }
}
