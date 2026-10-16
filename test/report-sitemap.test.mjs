import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderReportSitemap} from '../scripts/lib/report-sitemap.mjs';
import {readReportIndex,rebuildIndex} from '../scripts/lib/report-archive.mjs';
const xml='<urlset>\n  <url><loc>https://dendrogeo.org/</loc><lastmod>2026-10-16</lastmod></url>\n  <url><loc>https://dendrogeo.org/rapor/</loc><lastmod>2026-10-01</lastmod></url>\n  <url><loc>https://dendrogeo.org/rapor/DGR-2026-0021/</loc><lastmod>2026-10-04</lastmod></url>\n</urlset>\n';
test('report sitemap removes withdrawn entries, preserves other pages and is idempotent',()=>{
 const reports=[{id:'DGR-2026-0026',date:'2026-10-15'},{id:'DGR-2026-0025',date:'2026-10-14'}],out=renderReportSitemap(xml,reports);
 assert.ok(!out.includes('DGR-2026-0021'));assert.ok(out.includes('/rapor/DGR-2026-0026/'));assert.ok(out.includes('/</loc><lastmod>2026-10-16</lastmod>'));assert.equal(renderReportSitemap(out,reports),out);assert.ok(out.includes('/rapor/</loc><lastmod>2026-10-15</lastmod>'));
 assert.equal(renderReportSitemap(xml,[{id:'DGR-2026-0026',date:'<script>'}]).includes('DGR-'),false);
});
test('archive reindex updates discovery for publication and withdrawal without touching report artifacts',()=>{
 const root=mkdtempSync(join(tmpdir(),'dg-sitemap-')),dir=join(root,'rapor'),report=join(dir,'DGR-2026-0026');mkdirSync(report,{recursive:true});writeFileSync(join(root,'sitemap.xml'),xml);
 const data=JSON.stringify({park:{name:'Park'},totals:{n:1,ci:{mean:10,lo:8,hi:12}},generated_at:'2026-10-15T00:00:00Z'});writeFileSync(join(report,'data.json'),data);writeFileSync(join(report,'index.html'),'immutable report');
 assert.equal(readReportIndex(dir).length,1);rebuildIndex(dir);assert.ok(readFileSync(join(root,'sitemap.xml'),'utf8').includes('DGR-2026-0026'));assert.equal(readFileSync(join(report,'data.json'),'utf8'),data);assert.equal(readFileSync(join(report,'index.html'),'utf8'),'immutable report');
 unlinkSync(join(report,'data.json'));rebuildIndex(dir);assert.ok(!readFileSync(join(root,'sitemap.xml'),'utf8').includes('DGR-2026-0026'));
});
test('repository sitemap matches the valid report archive',()=>{
 const current=readFileSync(new URL('../sitemap.xml',import.meta.url),'utf8');assert.equal(renderReportSitemap(current,readReportIndex()),current);
 for(const workflow of ['ci.yml','rapor.yml','rapor-yayin.yml'])assert.ok(readFileSync(new URL('../.github/workflows/'+workflow,import.meta.url),'utf8').includes('git add rapor/ sitemap.xml'));
});
