import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const python=spawnSync('python3',['--version'],{encoding:'utf8'});
test('ZIP interoperates with Python zipfile and restore script verifies local photos in dry-run mode', {
 skip:python.status!==0?'Python 3 unavailable in this environment':false
},async()=>{
 const context={window:null,URL,TextEncoder,TextDecoder,Uint8Array,DataView,Blob};
 context.window=context;vm.createContext(context);
 for(const file of ['sql-value.js','build-snapshot.js','build-restore-sql.js','zip-archive.js'])
  vm.runInContext(readFileSync(new URL('../fotografli-tam-veri-arsivi/'+file,import.meta.url),'utf8'),context);
 const records={
  measurements:[{id:1,owner:'fixture-owner',photo_url:'https://fixture.supabase.co/storage/v1/object/public/dendro-photos/fixture-owner/tree.jpg'}],
  projects:[],waypoints:[],data_requests:[],parks:[],surface_reviews:[],profiles:[{id:'fixture-owner'}],
  report_requests:[],report_retractions:[],park_invites:[],park_collaborators:[],site_metric_daily:[],site_visits:[]
 };
 const bk=context.DG_BACKUP_SNAPSHOT.buildComplete({...records,requests:records.data_requests},
  {exportedAt:'2026-10-20T04:00:00Z',exportedBy:'Fixture'});
 const sql=context.DG_BUILD_RESTORE_SQL.buildComplete(bk,context.DG_BACKUP_SQL_VALUE.serialize).sql;
 const photo=new Uint8Array([255,216,255,217]),storage={bucket:'dendro-photos',sourceOrigin:'https://fixture.supabase.co',
  photos:[{path:'fixture-owner/tree.jpg',blob:new Blob([photo]),bytes:photo.length,contentType:'image/jpeg'}],
  downloadedBytes:photo.length,referencedCount:1};
 let blob;
 const browser={crypto:webcrypto,Blob,URL:{createObjectURL(value){blob=value;return'blob:fixture';},revokeObjectURL(){}},
  document:{createElement(){return{click(){},remove(){}};},body:{appendChild(){}}},
  setTimeout(){}};
 await context.DG_BACKUP_JSON_DOWNLOAD.downloadComplete(browser,bk,storage,'fixture.zip',sql);
 assert.ok(blob);
 const directory=mkdtempSync(join(tmpdir(),'dg-photo-archive-'));
 try{
  const archive=join(directory,'fixture.zip');
  writeFileSync(archive,Buffer.from(await blob.arrayBuffer()));
  const unpackScript=[
   'import pathlib,sys,zipfile',
   'path=pathlib.Path(sys.argv[1])',
   'target=path.parent/"unpacked"',
   'with zipfile.ZipFile(path) as zip:',
   ' assert zip.testzip() is None',
   ' names=set(zip.namelist())',
   ' assert "data/backup.json" in names',
   ' assert "restore/data_restore.sql" in names',
   ' assert "restore/restore_photos.py" in names',
   ' assert "storage/dendro-photos/fixture-owner/tree.jpg" in names',
   ' zip.extractall(target)',
   'print(str(target))'
  ].join('\n');
  const unpack=spawnSync('python3',['-c',unpackScript,archive],{encoding:'utf8',timeout:20000});
  assert.equal(unpack.status,0,unpack.stderr);
  const dry=spawnSync('python3',['restore/restore_photos.py'],{cwd:join(directory,'unpacked'),encoding:'utf8',timeout:20000});
  assert.equal(dry.status,0,dry.stderr);
  assert.match(dry.stdout,/Verified 1 photo files/);
  assert.match(dry.stdout,/Dry-run only/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
