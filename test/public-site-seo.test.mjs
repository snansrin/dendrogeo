import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {documentIdentity,applyDocumentIdentity} from '../scripts/lib/public-site-seo.mjs';
test('site identity uses one brand and document breadcrumbs without inventing a search service',()=>{
 const root=documentIdentity({url:'https://dendrogeo.org/',title:'DendroGeo',description:'GIS',home:true});assert.equal(root.filter(x=>x['@type']==='WebSite').length,1);assert.equal(root.find(x=>x['@type']==='WebSite').name,'DendroGeo');assert.ok(!JSON.stringify(root).includes('SearchAction'));
 const page=documentIdentity({url:'https://dendrogeo.org/arazi-ortusu/',title:'Arazi Örtüsü | DendroGeo',description:'Yüzey verisi'});assert.equal(page[0].isPartOf['@id'],'https://dendrogeo.org/#website');assert.equal(page[1].itemListElement[1].item,'https://dendrogeo.org/arazi-ortusu/');
 const html='<head></head>',metadata={url:'https://dendrogeo.org/',title:'DendroGeo',description:'<script>',home:true};assert.equal(applyDocumentIdentity(applyDocumentIdentity(html,metadata),metadata),applyDocumentIdentity(html,metadata));assert.ok(!applyDocumentIdentity(html,metadata).includes('"description": "<script>"'));
});
test('sitemap discoveries are canonical indexable pages and exclude test and withdrawn publications',()=>{
 const xml=readFileSync(new URL('../sitemap.xml',import.meta.url),'utf8');for(const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)){const url=new URL(match[1]);assert.equal(url.origin,'https://dendrogeo.org');const path=url.pathname==='/'?'index.html':url.pathname.slice(1)+'index.html';const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');assert.ok(html.includes('rel="canonical" href="'+url.href+'"'));assert.ok(!/name="robots"[^>]*noindex/i.test(html));}
 assert.ok(!xml.includes('DGR-2026-0019'));
 assert.ok(!existsSync(new URL('../rapor/DGR-2026-0019/',import.meta.url)),'removed test publication must have no public route');
 assert.ok(!xml.includes('DGR-2026-0021'));
 assert.match(readFileSync(new URL('../rapor/DGR-2026-0021/index.html',import.meta.url),'utf8'),/name="robots"[^>]*noindex/);
 assert.ok(xml.includes('hreflang="en" href="https://dendrogeo.org/en/"'));
});
