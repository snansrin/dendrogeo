import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parsePublication,zenodoMetadata} from '../scripts/lib/publication.mjs';
import {renderReport,buildMetadata,parkHistory} from '../scripts/make-report.mjs';
import {canonicalHash} from '../scripts/lib/mc.mjs';
const study={schema:'dendrogeo-publication/1',title:'Kent parkı karbon envanteri',project:'Park araştırması',researcher:'Örnek Araştırmacı',institution:'Örnek Üniversite',purpose:'Karbon stokunun belirlenmesi.',sampling:'Parkta bireysel ağaç envanteri.',instruments:'Çap ölçer ve boy ölçer.',start_date:'2026-09-01',end_date:'2026-09-28',study_type:'research'};
test('metadata rejects missing required fields, impossible dates and thesis without advisor',()=>{
 assert.equal(parsePublication(JSON.stringify(study)).title,study.title);
 assert.throws(()=>parsePublication('uygulama içi yayın'));
 for(const k of ['project','researcher','institution','purpose','sampling','instruments'])assert.throws(()=>parsePublication({...study,[k]:'  '}));
 for(const dates of [{start_date:'2026-02-30'},{end_date:'2026-08-01'},{end_date:'2999-01-01'}])assert.throws(()=>parsePublication({...study,...dates}));
 assert.throws(()=>parsePublication({...study,study_type:'thesis'}));
 assert.ok(parsePublication({...study,study_type:'thesis',supervisor:'Dr. Örnek'}));
 assert.equal(parsePublication({...study,role:'admin',doi:'10.1234/fake'}).role,undefined);
});
test('test publication IDs cannot enter new report history',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dg-publication-history-'));
 writeFileSync(join(dir,'test-publications.json'),JSON.stringify({report_ids:['DGR-2026-0001']}));
 writeFileSync(join(dir,'yayin-kuyrugu.json'),JSON.stringify({retired_report_ids:['DGR-2026-0001'],entries:[{report_id:'DGR-2026-0001',park_id:1,status:'Yayınlandı'},{report_id:'DGR-2026-0021',park_id:1,status:'Yayınlandı'}]}));
 assert.deepEqual(parkHistory(dir,1,'DGR-2026-0022').map(h=>h.id),['DGR-2026-0021']);
});
test('cancelled publication form writes no request; confirmed form preserves RLS-safe metadata payload',async()=>{
 let sent=0;const ctx=vm.createContext({$:()=>null,USER:{id:'u'},PROFILE:{role:'admin'},DG_USER_PUB:{},document:{getElementById:()=>null},toast:()=>{},setInterval:()=>0,clearInterval:()=>{},JSON,Date,Number,String,window:{},sb:{auth:{getSession:async()=>({data:{session:{access_token:'session'}}})}},SB_URL:'https://example.invalid',SB_KEY:'anon',fetch:async()=>{sent++;return{status:201}},confirm:()=>true});
 vm.runInContext(readFileSync(new URL('../src/services/report-publish.js',import.meta.url),'utf8'),ctx);
 vm.runInContext('dgReportCollectRequest=async()=>null;dgPubAdmin=()=>true;dgLoadPublishQueue=async()=>{};dgPubSchedulePoll=()=>{}',ctx);
 await vm.runInContext('dgPublishReport(1)',ctx);assert.equal(sent,0);
 ctx.study=study;vm.runInContext('dgReportCollectRequest=async()=>{const r=await dgPubInsertRequest(1,true,JSON.stringify(study));return r;}',ctx);await vm.runInContext('dgPublishReport(1)',ctx);assert.equal(sent,1);
});
test('Zenodo export carries study title and affiliation without an invented DOI',()=>{
 const m=zenodoMetadata({publication:study,author:{name:'Araştırmacı'}},'DGR-2026-0021');assert.equal(m.title,study.title);assert.equal(m.creators[0].affiliation,study.institution);assert.equal(m.doi,undefined);
});
