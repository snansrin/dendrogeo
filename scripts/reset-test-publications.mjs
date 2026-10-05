#!/usr/bin/env node
/* One-time production transition requested by the repository owner. */
import {readdirSync,readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderRetractionNotice,rebuildIndex,DGR_ID_RE} from './make-report.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=join(root,'rapor'),manifest=join(dir,'test-publications.json');
if(existsSync(manifest)){console.log('Test yayını geçişi daha önce tamamlandı.');process.exit(0);}
const ids=readdirSync(dir).filter(x=>DGR_ID_RE.test(x)).sort(),now=new Date().toISOString();
const q=JSON.parse(readFileSync(join(dir,'yayin-kuyrugu.json'),'utf8'));
for(const id of ids){
 const d=join(dir,id),pub=q.entries.find(e=>e.status==='Yayınlandı'&&e.report_id===id);
 for(const file of readdirSync(d))if(file!=='index.html')unlinkSync(join(d,file));
 writeFileSync(join(d,'index.html'),renderRetractionNotice({id,parkName:pub?.park_name||'',reason:'Test yayını. Üretim yayınına geçiş kapsamında yayından kaldırılmıştır. Bilimsel rapor olarak kullanılmamalıdır.',retractedAt:now}));
 q.entries.push({report_id:id,park_id:pub?.park_id||null,status:'Geri çekildi',test_publication:true,reason:'Test yayını — üretim geçişi',finished_at:now});
}
writeFileSync(manifest,JSON.stringify({schema:'dendrogeo-test-publications/1',transition_at:now,report_ids:ids},null,2)+'\n');
q.updated_at=now;writeFileSync(join(dir,'yayin-kuyrugu.json'),JSON.stringify(q,null,2)+'\n');rebuildIndex(dir);
console.log(ids.length+' test raporu yayından kaldırıldı; kimlikler korunmuştur.');
