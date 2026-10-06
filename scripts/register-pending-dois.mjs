#!/usr/bin/env node
/* Active production reports receive a real Zenodo DOI automatically.
 * The token is read only from ZENODO_TOKEN; it is never written to Git. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const QUEUE=join(ROOT,'rapor','yayin-kuyrugu.json');
const DGR=/^DGR-\d{4}-\d{4}$/;

export function activePublishedReports(queue){
 const entries=Array.isArray(queue?.entries)?queue.entries:[];
 const retracted=new Set(entries.filter(e=>e.status==='Geri çekildi'&&DGR.test(String(e.report_id||''))).map(e=>String(e.report_id)));
 const latest=new Map();
 for(const e of entries){
  const id=String(e.report_id||'');
  if(e.status==='Yayınlandı'&&DGR.test(id))latest.set(id,e);
 }
 return [...latest.entries()].filter(([id])=>!retracted.has(id));
}

function syncDoi(entry,id){
 const p=join(ROOT,'rapor',id,'doi.json');
 if(!existsSync(p))return false;
 const d=JSON.parse(readFileSync(p,'utf8'));
 if(d.report_id!==id||!/^10\.5281\/zenodo\.\d+$/.test(String(d.doi||'')))throw Error(id+' DOI kaydı geçersiz.');
 entry.doi=d.doi;
 entry.doi_url=d.url||('https://doi.org/'+d.doi);
 entry.doi_record_url=d.record_url||null;
 entry.doi_status='Kayıtlı';
 entry.doi_registered_at=d.registered_at||null;
 delete entry.doi_message;
 return true;
}

export async function registerPendingDois(){
 if(!existsSync(QUEUE)){console.log('ℹ Yayın günlüğü yok; DOI işi atlandı.');return{processed:0,failed:0};}
 const q=JSON.parse(readFileSync(QUEUE,'utf8'));
 const active=activePublishedReports(q);
 const candidates=active.filter(([id,e])=>existsSync(join(ROOT,'rapor',id,'data.json'))&&!syncDoi(e,id));
 if(!candidates.length){
  q.updated_at=new Date().toISOString();
  writeFileSync(QUEUE,JSON.stringify(q,null,2)+'\n');
  console.log('✅ DOI bekleyen aktif üretim raporu yok.');
  return{processed:0,failed:0};
 }
 if(!process.env.ZENODO_TOKEN)throw Error('ZENODO_TOKEN secret tanımlı değil; otomatik DOI kaydı yapılamaz.');
 let ok=0,fail=0;
 for(const [id,entry] of candidates){
  entry.doi_status='Kaydediliyor';
  entry.doi_last_attempt_at=new Date().toISOString();
  try{
   console.log('▶ DOI kaydı: '+id);
   execFileSync(process.execPath,[join(ROOT,'scripts','register-doi.mjs'),id,'--publish'],{stdio:'inherit',env:process.env});
   if(!syncDoi(entry,id))throw Error(id+' DOI dosyası oluşmadı.');
   ok++;
   console.log('  ✅ '+id+' · '+entry.doi);
  }catch(e){
   fail++;
   entry.doi_status='Başarısız';
   entry.doi_message=String((e&&e.message)||e).slice(0,300);
   console.error('  ❌ '+id+' · '+entry.doi_message);
  }
  q.updated_at=new Date().toISOString();
  writeFileSync(QUEUE,JSON.stringify(q,null,2)+'\n');
 }
 if(fail)throw Error(fail+' raporun otomatik DOI kaydı başarısız.');
 return{processed:ok,failed:0};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 registerPendingDois().catch(e=>{console.error('❌ '+String((e&&e.message)||e));process.exit(1);});
}
