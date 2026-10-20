import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const hasPython=spawnSync('python3',['--version'],{encoding:'utf8'}).status===0;
const previous=globalThis.window;
globalThis.window={crypto:webcrypto,Blob,URL};
await import('../src/domain/backup/photo-full-snapshot.mjs');
await import('../src/domain/backup/photo-full-restore-sql.mjs');
await import('../src/domain/backup/photo-full-sql-value.mjs');
await import('../src/adapters/backup/photo-full-zip.mjs');

test('owner-admin backup is standard Python-readable ZIP; photo restore dry run changes no data',{
 skip:!hasPython?'Python 3 unavailable':false
},async()=>{
 const records={measurements:[{id:1,owner:'owner',photo_url:'https://fixture.supabase.co/storage/v1/object/public/dendro-photos/owner/tree.jpg'}],
  projects:[],waypoints:[],data_requests:[],parks:[],surface_reviews:[],
  profiles:[{id:'owner'}],report_requests:[],report_retractions:[],park_invites:[],
  park_collaborators:[],site_metric_daily:[],site_visits:[]};
 const backup=window.DG_PHOTO_ARCHIVE_SNAPSHOT.buildComplete({...records,requests:records.data_requests},{
  exportedAt:'2026-10-20T08:00:00Z',exportedBy:'Fixture'});
 const sql=window.DG_PHOTO_ARCHIVE_RESTORE_SQL.buildComplete(backup,window.DG_PHOTO_ARCHIVE_SQL_VALUE.serialize).sql;
 const bytes=new Uint8Array([255,216,255,217]);
 const storage={bucket:'dendro-photos',sourceOrigin:'https://fixture.supabase.co',
  photos:[{path:'owner/tree.jpg',blob:new Blob([bytes]),bytes:bytes.length,contentType:'image/jpeg'}],
  downloadedBytes:bytes.length,referencedCount:1};
 const result=await window.DG_PHOTO_ARCHIVE_ZIP.downloadComplete(window,backup,storage,
  'dendrogeo_fotografli_tam_veri_arsivi_2026-10-20.zip',sql,{deferDownload:true});
 const temp=mkdtempSync(join(tmpdir(),'dg-admin-photo-zip-'));
 try{
  const file=join(temp,'backup.zip');
  writeFileSync(file,Buffer.from(await result.archive.arrayBuffer()));
  const code=[
   'import pathlib,sys,zipfile',
   'archive=pathlib.Path(sys.argv[1])',
   'destination=archive.parent/"unpacked"',
   'with zipfile.ZipFile(archive) as z:',
   ' assert z.testzip() is None',
   ' names=set(z.namelist())',
   ' assert "restore/restore_photos.py" in names',
   ' assert "restore/data_restore.sql" in names',
   ' assert "storage/dendro-photos/owner/tree.jpg" in names',
   ' z.extractall(destination)'
  ].join('\n');
  const opened=spawnSync('python3',['-c',code,file],{encoding:'utf8',timeout:20000});
  assert.equal(opened.status,0,opened.stderr);
  const dry=spawnSync('python3',['restore/restore_photos.py'],{cwd:join(temp,'unpacked'),encoding:'utf8',timeout:20000});
  assert.equal(dry.status,0,dry.stderr);
  assert.match(dry.stdout,/Verified 1 photo files/);
  assert.match(dry.stdout,/Dry-run only/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
