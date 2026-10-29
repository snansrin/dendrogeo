import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {INDEXABLE_PATHS,PUBLIC_DOCUMENT_PATHS,applyIndexingPolicy,landingOnlySitemap} from '../scripts/lib/public-indexing-policy.mjs';
import {createReportDocumentHead} from '../scripts/lib/report-document-head.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('only TR/EN landings are indexable; supporting documents retain their own URLs and public links',()=>{
 const xml=read('sitemap.xml');assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]),INDEXABLE_PATHS.map(p=>'https://dendrogeo.org'+p));
 for(const path of PUBLIC_DOCUMENT_PATHS){
  const html=read(path==='/'?'index.html':path.slice(1)+'index.html');
  assert.match(html,new RegExp('rel="canonical" href="https://dendrogeo.org'+path+'"'));
  const robots=html.match(/<meta name="robots" content="([^"]+)"/g)||[];assert.equal(robots.length,1,path);
  assert.equal(robots[0].includes('noindex'),!INDEXABLE_PATHS.includes(path),path);
  if(INDEXABLE_PATHS.includes(path))for(const lang of ['tr','en','x-default'])assert.ok(html.includes('hreflang="'+lang+'"'));
 }
 for(const dir of readdirSync(new URL('../rapor/',import.meta.url)).filter(x=>/^DGR-/.test(x)))assert.match(read('rapor/'+dir+'/index.html'),/name="robots"[^>]*noindex/);
 assert.match(read('rapor/gorunum/index.html'),/name="robots"[^>]*noindex/);
 for(const path of ['/karbon-hesaplama/','/yontem/','/rapor/','/gizlilik/'])assert.ok(read('index.html').includes('href="'+path+'"'));
 assert.doesNotMatch(read('robots.txt'),/Disallow:\s*\/(?:en\/|yontem\/|karbon-hesaplama\/|rapor\/)/,'noindex pages must remain crawlable');
});
test('index policy removes conflicting crawler tags and cannot grow sitemap during a publication',()=>{
 const source='<head><meta name="googlebot" content="index, follow"><meta name="robots" content="index"></head>';
 const html=applyIndexingPolicy(source,'/yontem/');assert.match(html,/noindex, follow/);assert.doesNotMatch(html,/googlebot/);assert.equal(applyIndexingPolicy(html,'/yontem/'),html);
 const xml='<urlset><url><loc>https://dendrogeo.org/</loc><lastmod>2026-10-29</lastmod></url><url><loc>https://dendrogeo.org/en/</loc></url><url><loc>https://dendrogeo.org/rapor/DGR-2026-9999/</loc></url></urlset>';
 const result=landingOnlySitemap(xml);assert.doesNotMatch(result,/rapor/);assert.match(result,/2026-10-29/);assert.equal(landingOnlySitemap(result),result);
});
test('new report metadata is noindex without changing report calculations or identity',()=>{
 const render=createReportDocumentHead({esc:String,fmtT:String,reportStyles:()=>'',siteOrigin:'https://dendrogeo.org'});
 const html=render({id:'DGR-2026-9999',P:{name:'Fixture',city:'Fixture'},t:{n:1,ci:{mean:10,lo:9,hi:11}},dataset:'Fixture',ciTxt:'10',hash:'1234567890abcdef',L:null,jsonld:{'@type':'Report'}});
 assert.match(html,/name="robots" content="noindex, follow"/);assert.match(html,/rel="canonical" href="https:\/\/dendrogeo.org\/rapor\/DGR-2026-9999\//);
});
