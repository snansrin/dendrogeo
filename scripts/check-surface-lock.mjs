#!/usr/bin/env node
/* DendroGeo — read-only surface engine source lock.
 * It never overwrites or deletes user data, accepted reports or source files.
 * Updating the manifest alone cannot silently approve source edits: its own
 * Git blob identity is pinned independently below.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';

export const SURFACE_LOCK_ID='DG-SURFACE-LOCK-2026-10-08';
export const APPROVED_COMMIT='7680cab4a7fd9102bef64e5cf031b740940a5be0';
export const PINNED_MANIFEST_BLOB='51fbd4f115989179411e8a2f9ea9093dc2265361';
const PROJECT_ROOT=fileURLToPath(new URL('../',import.meta.url));
const MANIFEST='docs/surface-engine-lock.json';

export function gitBlobSha(bytes){
 const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
 return createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
}

export function verifySurfaceFiles(root,lockedFiles){
 const errors=[];
 if(!lockedFiles||typeof lockedFiles!=='object'||Array.isArray(lockedFiles))return ['Kilit listesi geçersiz.'];
 for(const [path,expected] of Object.entries(lockedFiles)){
  if(!/^([a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+$/.test(path)||path.includes('..')){
   errors.push('Geçersiz yol: '+path);continue;
  }
  if(!/^[a-f0-9]{40}$/.test(expected)){errors.push('Geçersiz hash: '+path);continue;}
  try{
   const actual=gitBlobSha(readFileSync(join(root,path)));
   if(actual!==expected)errors.push('KİLİTLİ DOSYA DEĞİŞTİ: '+path+' (beklenen '+expected+', mevcut '+actual+')');
  }catch(e){errors.push('KİLİTLİ DOSYA EKSİK: '+path+' ('+(e.code||e.message)+')');}
 }
 return errors;
}

export function verifySurfaceLock(root=PROJECT_ROOT){
 const errors=[];
 let bytes,manifest;
 try{bytes=readFileSync(join(root,MANIFEST));}
 catch(e){return ['Kilit manifesti okunamadı: '+e.message];}
 if(gitBlobSha(bytes)!==PINNED_MANIFEST_BLOB)errors.push('KİLİT MANİFESTİ DEĞİŞTİ: kullanıcı onayı olmadan kilit güncellenemez.');
 try{manifest=JSON.parse(bytes.toString('utf8'));}
 catch(e){return [...errors,'Kilit manifesti JSON değil: '+e.message];}
 if(manifest.id!==SURFACE_LOCK_ID||manifest.baseline_commit!==APPROVED_COMMIT||
    manifest.schema!=='dendrogeo/surface-engine-source-lock/v1'||
    manifest.policy!=='NO_CHANGES_WITHOUT_EXPLICIT_USER_APPROVAL')
  errors.push('Kilit kimliği, referansı veya koruma politikası değişti.');
 if(Object.keys(manifest.locked_files||{}).length!==51)errors.push('Korunan dosya sayısı değişti (beklenen 51).');
 if(manifest.recovery_branch!=='recovery/surface-verified-water-20261008'||
    manifest.verified_conditions_file!=='docs/surface-scientific-contract.json'||
    !manifest.source_caveat?.includes('dynamic'))
  errors.push('Onaylı kurtarma noktası veya tekrarlanabilirlik uyarısı değiştirildi.');

 return [...errors,...verifySurfaceFiles(root,manifest.locked_files)];
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const errors=verifySurfaceLock();
 if(errors.length){
  for(const error of errors)console.error('🔴 '+error);
  console.error('Korunan yüzey çekirdeği izinsiz değiştirilemez. Önce kullanıcıdan açık onay alın; mevcut sonucu otomatik güncellemeyin.');
  process.exitCode=1;
 }else{
  console.log('✅ '+SURFACE_LOCK_ID+' · 51 kilitli analiz/QA/bağımlılık dosyası ve manifest değişmedi.');
 }
}
