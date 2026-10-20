import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const exists=path=>existsSync(new URL('../'+path,import.meta.url));

test('no public backup or Oracle staging page remains addressable by a known index',()=>{
 for(const path of [
  'fotografli-tam-veri-arsivi/index.html',
  'tam-yedek/index.html',
  'oracle-storage-check/index.html'
 ])assert.equal(exists(path),false,path);
 for(const path of ['fotografli-tam-veri-arsivi/app.js','tam-yedek/app.mjs','tam-yedek/style.css'])
  assert.equal(exists(path),false,path);
 assert.doesNotMatch(read('README.md'),/https:\/\/dendrogeo\.org\/fotografli-tam-veri-arsivi\//);
});

test('existing frozen admin panel owns both archive and restore controls',()=>{
 const html=read('partials/shell.html');
 const start=html.indexOf('id="v-admin"'),end=html.indexOf('<!-- PARK KİMLİKLERİ',start);
 assert.ok(start>=0&&end>start);
 const section=html.slice(start,end);
 assert.match(section,/data-dg-backup-action="download"/);
 assert.match(section,/data-dg-backup-action="pick-file"/);
 assert.match(section,/data-dg-backup-action="restore-file"/);
 assert.doesNotMatch(section,/<iframe\b|href="\/(?:tam-yedek|fotografli-tam-veri-arsivi|oracle-storage-check)/);
});

test('admin UI mounts separate photo ZIP button without altering legacy JSON export',()=>{
 const source=read('src/ui/photo-admin-controls.mjs');
 const events=[],notes=[];
 const makeButton=()=>({
  textContent:'',disabled:false,attributes:{},handlers:{},
  setAttribute(k,v){this.attributes[k]=v;},
  addEventListener(k,v){this.handlers[k]=v;}
 });
 const download=makeButton(),restore=makeButton();
 download.textContent='💾 Tam Veri Yedeği (JSON)';
 const input={accept:'.json',nextElementSibling:{classList:{contains:k=>k==='dg-meta'},textContent:''},
  parentNode:{insertBefore(node){notes.push(node);}}};
 let photo=null,status=null;
 download.parentNode={insertBefore(node){photo=node;events.push('photo-insert');}};
 const panel={querySelector:selector=>({
  '[data-dg-backup-action="download"]':download,
  '[data-dg-backup-action="pick-file"]':restore,
  '[data-dg-backup-action="restore-file"]':input,
  '#dgPhotoArchiveAdminDownload':photo
 })[selector]||null};
 const document={
  getElementById:id=>id==='v-admin'?panel:
   id==='dgPhotoArchiveAdminDownload'?photo:
   id==='dgPhotoArchiveAdminStatus'?status:null,
  createElement:tag=>{
   const element=makeButton();
   if(tag==='p'){status=element;}
   return element;
  }
 };
 let photoCalls=0;
 const window={dgPhotoFullBackup(){photoCalls++;}};
 vm.runInNewContext(source,{window,document});
 window.DG_PHOTO_ARCHIVE_UI.mount();
 assert.equal(download.textContent,'💾 Tam Veri Yedeği (JSON)');
 assert.equal(photo.id,'dgPhotoArchiveAdminDownload');
 assert.equal(photo.className,'btn sm');
 assert.match(photo.textContent,/Fotoğraflı Tam Veri Arşivi/);
 assert.match(restore.textContent,/Geri Yükleme/);
 assert.match(input.accept,/\.zip/);
 assert.match(input.nextElementSibling.textContent,/13 erişilebilir tablo/);
 assert.equal(status.attributes.role,'status');
 photo.handlers.click();
 assert.equal(photoCalls,1);
 window.DG_PHOTO_ARCHIVE_UI.status('Kontrol ediliyor');
 assert.equal(status.textContent,'Kontrol ediliyor');
 window.DG_PHOTO_ARCHIVE_UI.busy(true);
 assert.equal(photo.disabled,true);
 assert.equal(download.disabled,true);
 assert.equal(restore.disabled,true);
 window.DG_PHOTO_ARCHIVE_UI.busy(false);
 assert.equal(photo.disabled,false);
 assert.equal(download.disabled,false);
 assert.equal(restore.disabled,false);
 window.DG_PHOTO_ARCHIVE_UI.mount();
 assert.equal(events.filter(x=>x==='photo-insert').length,1);
});
test('browser-only backup has a fresh server identity gate and no implicit remote upload',()=>{
 const source=read('src/application/backup/photo-full-workflow.mjs');
 assert.match(source,/client\.auth\.getUser\(\)/);
 assert.match(source,/profile\.data\?\.role!=='owner'/);
 assert.match(source,/deferDownload:true/);
 assert.match(source,/readComplete\(window,result\.archive\)/);
 assert.doesNotMatch(source,/\.upload\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.remove\s*\(/);
 const service=read('src/services/backup.js');
 assert.match(service,/PROFILE\.role!=='owner'/);
 assert.match(service,/DG_PHOTO_ARCHIVE_ZIP\.saveBlob/);
 assert.match(service,/inspectOwnerArchive/);
});
