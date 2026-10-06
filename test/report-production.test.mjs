import {test} from 'node:test';import assert from'node:assert/strict';import{mkdtempSync,readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{resetTestPublications}from'../scripts/reset-test-publications.mjs';import{prepareReportDoi}from'../scripts/prepare-report-doi.mjs';import{planQueue,saveQueue,loadQueue,QUEUE_SCHEMA}from'../scripts/publish-queue.mjs';import{renderReport,buildMetadata}from'../scripts/make-report.mjs';import{canonicalHash}from'../scripts/lib/mc.mjs';
const snap=JSON.parse(readFileSync(new URL('./fixtures/report-snapshot.json',import.meta.url))),hash=canonicalHash(snap);
test('test arşivi eski kuyruğu ve talepleri yeniden yayımlamaz; üretim ikinci sıfırlamayı engeller',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dg-production-'));mkdirSync(join(dir,'DGR-2026-0020'));writeFileSync(join(dir,'DGR-2026-0020','data.json'),'{}');writeFileSync(join(dir,'yayin-kuyrugu.json'),JSON.stringify({schema:QUEUE_SCHEMA,entries:[{request_id:'old',report_id:'DGR-2026-0020'}]}));
 assert.throws(()=>resetTestPublications({dir}),/yedek/);assert.ok(existsSync(join(dir,'DGR-2026-0020','data.json')));
 const q=resetTestPublications({dir,backupRef:'archive/test',requests:[{id:'pending',kind:'request'},{id:'retract',kind:'retraction'}]});
 assert.deepEqual(q.retired_report_ids,['DGR-2026-0020']);assert.ok(!existsSync(join(dir,'DGR-2026-0020','data.json')));assert.deepEqual(q.processed_retraction_ids,['retract']);
 const plan=planQueue([],[{id:'old'},{id:'pending'},{id:'new'}],10,q.processed_request_ids);assert.deepEqual(plan.todo.map(r=>r.id),['new']);
 saveQueue(q,join(dir,'yayin-kuyrugu.json'));assert.deepEqual(loadQueue(join(dir,'yayin-kuyrugu.json')).processed_request_ids,['old','pending']);
 assert.throws(()=>resetTestPublications({dir,backupRef:'archive/test'}),/tekrar uygulanamaz/);
});
test('atanmış DOI atıf, BibTeX, JSON-LD ve üst veride aynı kimliktir',()=>{
 const doi='10.5281/zenodo.123456789',meta={doi};const html=renderReport(snap,{id:'DGR-2026-0021',hash,meta});const md=buildMetadata(snap,{id:'DGR-2026-0021',hash,meta});assert.equal(md.doi,doi);assert.ok(md.relatedIdentifiers.some(r=>r.relatedIdentifier===doi&&r.relationType==='IsIdenticalTo'));assert.ok(html.includes('doi       = {'+doi+'}'));const ld=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);assert.equal(ld.identifier.value,doi);
});
test('geçersiz DOI hiçbir yayın alanında DOI olarak kullanılmaz',()=>{const meta={doi:'javascript:alert(1)'};const md=buildMetadata(snap,{id:'DGR-2026-0021',hash,meta});assert.equal(md.doi,null);assert.match(md.doiNote,/atanmadı/);assert.ok(!renderReport(snap,{id:'DGR-2026-0021',hash,meta}).includes('javascript:alert'));});
test('DOI hazırlığı tam yazar adı, Report türü, rezervasyon isteği ve dosya hashlerini taşır; DOI atamaz',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dg-doi-')),metadata=buildMetadata(snap,{id:'DGR-2026-0021',hash});metadata.doi=null;writeFileSync(join(dir,'data.json'),JSON.stringify(snap));writeFileSync(join(dir,'metadata.json'),JSON.stringify(metadata));for(const f of ['rapor.pdf','index.html','olcum.csv','park.geojson','harita.png','surface.geojson'])writeFileSync(join(dir,f),'fixture:'+f);const p=prepareReportDoi(dir);assert.equal(p.metadata.creators[0].name,snap.author.name);assert.equal(p.metadata.publication_type,'report');assert.equal(p.metadata.prereserve_doi,true);assert.equal(p.manifest.doi,null);assert.equal(p.manifest.registration_status,'not_registered');assert.ok(p.manifest.files.every(f=>/^[0-9a-f]{64}$/.test(f.sha256)));const altered={...snap,totals:{...snap.totals,n:37}};writeFileSync(join(dir,'data.json'),JSON.stringify(altered));assert.throws(()=>prepareReportDoi(dir),/SHA-256/);
});
test('Zenodo description identifies measured trees explicitly and escapes public metadata',async()=>{const{reportDoiDescription}=await import('../scripts/prepare-report-doi.mjs');const md=buildMetadata(snap,{id:'DGR-2026-0021',hash});const description=reportDoiDescription(md,{...snap,park:{...snap.park,name:'Park <script>'}});assert.ok(description.includes('ağaç ölçüm kaydı'));assert.ok(description.includes('ölçüm kaydı bulunan ağaçlarla sınırlıdır'));assert.ok(!description.includes('birey'));assert.ok(description.includes('DBH, cm'));assert.ok(description.includes('&lt;script&gt;'));assert.ok(description.includes(md.resultHash.replace('sha256:','')));});


test('akademik proje künyesi uzun metinde taşmaz ve tam satır kullanır',()=>{
 const study={author_name:'Araştırmacı',project_name:'Çok uzun bilimsel proje adı / saha uygulaması / araştırma paketi 2026',title:'Başlık',purpose:'Amaç'};
 const html=renderReport({...snap,study},{id:'DGR-2026-0099',hash,meta:{study}});
 assert.match(html,/\.meta>div\{min-width:0\}/);
 assert.match(html,/\.meta code\{display:block;max-width:100%/);
 assert.match(html,/\.meta \.meta-wide\{grid-column:1\/-1\}/);
 assert.match(html,/class="meta-wide"><b>Proje<\/b>/);
});
