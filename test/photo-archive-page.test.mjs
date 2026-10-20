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

test('admin UI mounts photo archive labels with existing theme classes and keyboard controls',()=>{
 const readModule=read('src/ui/photo-admin-controls.mjs');
 const newStatus={id:'dgPhotoArchiveAdminStatus',attributes:{},setAttribute(k,v){this.attributes[k]=v;}};
 const note={classList:{contains:c=>c==='dg-meta'},textContent:''};
 const input={accept:'.json',nextElementSibling:note,parentNode:{insertBefore(node){assert.equal(node,newStatus);}},disabled:false};
 const mkButton=()=>({textContent:'',attributes:{},disabled:false,setAttribute(k,v){this.attributes[k]=v;}});
 const download=mkButton(),restore=mkButton();
 const bySelector={
  '[data-dg-backup-action="download"]':download,
  '[data-dg-backup-action="pick-file"]':restore,
  '[data-dg-backup-action="restore-file"]':input
 };
 const panel={querySelector:x=>bySelector[x]};
 let statusCreated=false;
 const document={
  readyState:'complete',
  getElementById:id=>id==='v-admin'?panel:(id==='dgPhotoArchiveAdminStatus'&&(statusCreated?newStatus:null)),
  createElement:()=>{statusCreated=true;return newStatus;},
  addEventListener(){throw Error('DOMContentLoaded should not be registered when page is ready');}
 };
 const window={};
 vm.runInNewContext(readModule,{window,document});
 assert.match(download.textContent,/Fotoğraflı Tam Veri Arşivi/);
 assert.match(restore.textContent,/Geri Yükleme/);
 assert.match(input.accept,/\.zip/);
 assert.match(note.textContent,/13 erişilebilir tablo/);
 assert.match(newStatus.className,/dg-meta/);
 assert.equal(newStatus.attributes.role,'status');
 window.DG_PHOTO_ARCHIVE_UI.status('Kontrol ediliyor');
 assert.equal(newStatus.textContent,'Kontrol ediliyor');
 window.DG_PHOTO_ARCHIVE_UI.busy(true);
 assert.equal(download.disabled,true);
 assert.equal(restore.disabled,true);
 window.DG_PHOTO_ARCHIVE_UI.busy(false);
 assert.equal(download.disabled,false);
 assert.equal(restore.disabled,false);
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
