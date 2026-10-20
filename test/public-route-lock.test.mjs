import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';

// GitHub Pages serves source HTML without requiring a DendroGeo session.
// Restrict routable HTML to explicitly public marketing/legal pages, while
// leaving intentionally published scientific reports in rapor/ untouched.
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
const SKIP_DIRS=new Set(['.git','.github','node_modules','rapor','partials','test','tests']);
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
 const unexpected=pages.filter(page=>!PUBLIC_HTML.has(page));
 assert.deepEqual(unexpected,[], 'Unreviewed public HTML entry points: '+unexpected.join(', '));
 // A marketing-page change must not silently turn into an unrestricted owner
 // dashboard, Oracle staging panel or photo backup endpoint.
 for(const page of ['fotografli-tam-veri-arsivi/index.html','tam-yedek/index.html','oracle-storage-check/index.html'])
  assert.equal(pages.includes(page),false,page);
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
