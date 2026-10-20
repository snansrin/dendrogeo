import {readFileSync,writeFileSync,readdirSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {rebuildIndex,DGR_ID_RE} from './make-report.mjs';
// A reset removes test artifacts from the public catalogue. The git archive branch
// preserves the previous files; retired IDs and queue deduplication remain active.
export function resetTestPublications({dir,requests=[],backupRef,resetAt=new Date().toISOString()}){
 if(!backupRef)throw Error('Test yayınları için yedek referansı gerekli.');
 const path=join(dir,'yayin-kuyrugu.json'),q=JSON.parse(readFileSync(path,'utf8'));
 if(q.production_started_at||(q.entries||[]).some(e=>e.publication_stage==='production'))throw Error('Üretim yayınları başladı; test sıfırlaması tekrar uygulanamaz.');
 const ids=readdirSync(dir).filter(id=>DGR_ID_RE.test(id));
 // Test URLs must disappear entirely, rather than leave public placeholder pages.
 // IDs are validated above and remain reserved in the queue below.
 for(const id of ids)rmSync(join(dir,id),{recursive:true});
 const distinct=a=>[...new Set(a.filter(Boolean).map(String))];
 const out={schema:q.schema,updated_at:resetAt,production_started_at:resetAt,test_archive_ref:backupRef,retired_report_ids:distinct([...(q.retired_report_ids||[]),...ids]),processed_request_ids:distinct([...(q.processed_request_ids||[]),...(q.entries||[]).map(e=>e.request_id),...requests.filter(r=>r.kind==='request').map(r=>r.id)]),processed_retraction_ids:distinct([...(q.processed_retraction_ids||[]),...(q.entries||[]).map(e=>e.retraction_id),...requests.filter(r=>r.kind==='retraction').map(r=>r.id)]),entries:[]};
 out.archived_request_ids=out.processed_request_ids.slice();out.archived_retraction_ids=out.processed_retraction_ids.slice();
 writeFileSync(path,JSON.stringify(out,null,2)+'\n');rebuildIndex(dir);return out;
}
