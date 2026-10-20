import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';

// GitHub Pages serves source HTML without requiring a DendroGeo session.
// Restrict routable HTML to explicitly public marketing/legal pages and
// approved DGR report URL patterns, refusing arbitrary test/admin routes.
// Authenticated admin UI must stay in the existing gated main application.
const root=fileURLToPath(new URL('../',import.meta.url));
const PUBLIC_HTML=new Set([
 '404.html','index.html',
 'agac-envanteri/index.html',
 'arazi-ortusu/index.html',
 'aydinlatma/index.html',
 'en/data-protection/index.html',
 'en/index.html',
 'en/methods/index.html',
 'en/privacy/index.html',
 'en/terms/index.html',
 'gizlilik/index.html',
 'hakkimizda/index.html',
 'karbon-hesaplama/index.html',
 'kent-parklari/index.html',
 'kullanim-kosullari/index.html',
 'kunye/index.html',
 'veri/index.html',
 'yontem/index.html'
]);
const SKIP_DIRS=new Set(['.git','.github','node_modules','partials','test','tests']);
function scan(dir=root,files=[]){
 for(const item of readdirSync(dir,{withFileTypes:true})){
  if(item.isDirectory()){
   if(!SKIP_DIRS.has(item.name))scan(join(dir,item.name),files);
  }else if(item.isFile()&&/\.html?$/i.test(item.name)){
   files.push(relative(root,join(dir,item.name)).split('\\').join('/'));
  }
 }
 return files;
}
test('publicly accessible HTML entry routes are reviewed and explicitly allowlisted',()=>{
 const pages=scan();
 const publishedReport=page=>/^rapor\/(?:index\.html|gorunum\/index\.html|DGR-\d{4}-\d{4}\/index\.html)$/.test(page);
 const unexpected=pages.filter(page=>!PUBLIC_HTML.has(page)&&!publishedReport(page));
 assert.deepEqual(unexpected,[], 'Unreviewed public HTML entry points: '+unexpected.join(', '));
 // A marketing-page change must not silently turn into an unrestricted owner
 // dashboard, Oracle staging panel or photo backup endpoint.
 for(const page of ['fotografli-tam-veri-arsivi/index.html','tam-yedek/index.html','oracle-storage-check/index.html'])
  assert.equal(pages.includes(page),false,page);
});

test('build inputs and tooling cannot be published as standalone Pages routes',()=>{
 const config=readFileSync(join(root,'_config.yml'),'utf8');
 const excluded=new Set(config.split(/\r?\n/).map(line=>/^  - (\S+)\s*$/.exec(line)?.[1]).filter(Boolean));
 for(const path of ['partials','scripts','test','tests','supabase','docs','node_modules','AGENTS.md','package.json','package-lock.json'])
  assert.ok(excluded.has(path),'Build-only path must be excluded from Pages: '+path);
 assert.equal(existsSync(join(root,'.nojekyll')),false,'Do not bypass the Pages exclusions');
 for(const path of ['src','css','assets','vendor','rapor'])assert.equal(excluded.has(path),false,'Runtime/public path must stay available: '+path);
});

test('retired test report IDs have no remaining public directory or tombstone',()=>{
 const retired=JSON.parse(readFileSync(join(root,'rapor/test-publications.json'),'utf8')).report_ids;
 assert.ok(retired.length>0);
 for(const id of retired){
  assert.match(id,/^DGR-\d{4}-\d{4}$/);
  assert.equal(existsSync(join(root,'rapor',id)),false,'Retired test URL remains: '+id);
 }
});
test('root, metadata and public navigator contain no retired privileged links',()=>{
 for(const path of ['README.md','index.html','sitemap.xml']){
  const source=readFileSync(join(root,path),'utf8');
  assert.doesNotMatch(source,/https?:\/\/dendrogeo\.org\/(?:fotografli-tam-veri-arsivi|tam-yedek|oracle-storage-check)(?:\/|[\?"'#]|$)/i, 'Retired privileged URL referenced: '+path);
 }
});
test('photo archive is not a separate page; server identity and owner role are checked before reading',()=>{
 const source=readFileSync(join(root,'src/application/backup/photo-full-workflow.mjs'),'utf8');
 const ui=readFileSync(join(root,'src/ui/photo-admin-controls.mjs'),'utf8');
 assert.match(source,/client\.auth\.getUser\(\)/);
 assert.match(source,/profile\.data\?\.role!=='owner'/);
 assert.match(ui,/PROFILE\?\.role!=='owner'/);
 assert.match(ui,/v-admin/);
 assert.match(ui,/btn sm/);
});
