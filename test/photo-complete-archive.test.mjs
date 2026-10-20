import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const files=[
 'fotografli-tam-veri-arsivi/sql-value.js',
 'fotografli-tam-veri-arsivi/build-snapshot.js',
 'fotografli-tam-veri-arsivi/build-restore-sql.js',
 'fotografli-tam-veri-arsivi/zip-archive.js',
 'fotografli-tam-veri-arsivi/paged-store.js'
];
const context={URL,TextEncoder,TextDecoder,Uint8Array,DataView,Blob,window:null};
context.window=context;
vm.createContext(context);
for(const path of files)vm.runInContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),context,{filename:path});
const {DG_BACKUP_SNAPSHOT, DG_BUILD_RESTORE_SQL, DG_BACKUP_SQL_VALUE, DG_BACKUP_JSON_DOWNLOAD, DG_BACKUP_PAGED_STORE}=context;

function fixture(){
 const photoBytes=new TextEncoder().encode('real photo file payload\n');
 const origin='https://fixture.supabase.co',path='user-id/goksu/1.jpg';
 const input={
  measurements:[{id:7,owner:'user-id',photo_url:origin+'/storage/v1/object/public/dendro-photos/'+path}],
  projects:[{id:3}],waypoints:[],data_requests:[],parks:[],surface_reviews:[],
  profiles:[{id:'user-id'}],report_requests:[],report_retractions:[],
  park_invites:[],park_collaborators:[],site_metric_daily:[],site_visits:[]
 };
 const backup=DG_BACKUP_SNAPSHOT.buildComplete({...input,requests:input.data_requests},
  {exportedAt:'2026-10-20T00:00:00.000Z',exportedBy:'Tester'});
 const storage={bucket:'dendro-photos',sourceOrigin:origin,photos:[{path,blob:new Blob([photoBytes]),bytes:photoBytes.length,contentType:'image/jpeg'}],
  referencedCount:1,downloadedBytes:photoBytes.length};
 const sql=DG_BUILD_RESTORE_SQL.buildComplete(backup,DG_BACKUP_SQL_VALUE.serialize).sql;
 return{backup,storage,sql,photoBytes,path,origin};
}
function browser(){
 let zip,downloadName;
 const anchor={remove(){},click(){}};
 return{
  crypto:webcrypto,Blob,TextEncoder,URL:{createObjectURL(b){zip=b;return'blob:photo-archive';},revokeObjectURL(){}},
  document:{createElement(){return anchor;},body:{appendChild(){}}},
  setTimeout(){},
  get result(){return{zip,downloadName:anchor.download};}
 };
}

test('Fotoğraflı Tam Veri Arşivi: ZIP round-trip preserves 13 tables, real image bytes and SQL',async()=>{
 const f=fixture(),b=browser();
 const out=await DG_BACKUP_JSON_DOWNLOAD.downloadComplete(b,f.backup,f.storage,'photo.zip',f.sql);
 assert.equal(out.photos,1);assert.equal(b.result.downloadName,'photo.zip');
 assert.ok(out.bytes>f.photoBytes.length);
 const restored=await DG_BACKUP_JSON_DOWNLOAD.readComplete(b,b.result.zip);
 assert.equal(restored.backup.schema_version,'2.0.0');
 assert.equal(restored.photos.length,1);
 assert.equal(restored.photoBytes,f.photoBytes.length);
 assert.equal(restored.photos[0].path,f.path);
 assert.deepEqual(Array.from(restored.photos[0].data),Array.from(f.photoBytes));
 assert.equal(restored.restoreSql,f.sql);
 assert.equal(restored.backup.measurements[0].photo_url,f.backup.measurements[0].photo_url);
 assert.ok(restored.fileCount>=5);
});

test('Fotoğraflı Tam Veri Arşivi: changing a single image byte fails CRC/SHA validation',async()=>{
 const f=fixture(),b=browser();
 await DG_BACKUP_JSON_DOWNLOAD.downloadComplete(b,f.backup,f.storage,'photo.zip',f.sql);
 const arr=new Uint8Array(await b.result.zip.arrayBuffer());
 const hit=Array.from(arr).findIndex((_,i)=>i>60&&
  arr[i]===f.photoBytes[0]&&arr.slice(i,i+f.photoBytes.length).every((v,j)=>v===f.photoBytes[j]));
 assert.ok(hit>60);arr[hit]^=1;
 await assert.rejects(DG_BACKUP_JSON_DOWNLOAD.readComplete(b,new Blob([arr])),/CRC32|SHA-256|geçersiz/i);
});

test('Fotoğraflı Tam Veri Arşivi: changed table count fails restoration',async()=>{
 const f=fixture(),bad={...f.backup,counts:{...f.backup.counts,profiles:8}},b=browser();
 await DG_BACKUP_JSON_DOWNLOAD.downloadComplete(b,bad,f.storage,'bad.zip',f.sql);
 await assert.rejects(DG_BACKUP_JSON_DOWNLOAD.readComplete(b,b.result.zip),/tablosu|tablo/i);
});

test('Fotoğraflı Tam Veri Arşivi: missing measurement photo prevents any download',async()=>{
 const f=fixture(),calls=[];
 const sb={
  supabaseUrl:f.origin,
  storage:{from(name){
   assert.equal(name,'dendro-photos');
   return{async list(prefix){calls.push(['list',prefix]);return{data:[]};},async download(path){calls.push(['download',path]);return{error:{message:'missing'}};}};
  }}
 };
 await assert.rejects(DG_BACKUP_PAGED_STORE.archivePhotos(sb,'dendro-photos',f.backup.measurements),/Storage listesinde bulunamadı/);
 assert.deepEqual(calls,[['list','']]);
});

test('Fotoğraflı Tam Veri Arşivi: recursive Storage pagination and composite-key tables',async()=>{
 const f=fixture(),calls=[],blob=new Blob([f.photoBytes]);
 const sb={
  supabaseUrl:f.origin,
  storage:{from:()=>({
   async list(prefix){
    calls.push(['list',prefix]);
    return{data:prefix===''?[{name:'user-id',id:null}]:prefix==='user-id'?[{name:'goksu',id:null}]:[{id:'1',name:'1.jpg',metadata:{size:blob.size,mimetype:'image/jpeg'}}]};
   },
   async download(path){calls.push(['download',path]);return{data:blob};}
  })}
 };
 const objects=await DG_BACKUP_PAGED_STORE.archivePhotos(sb,'dendro-photos',f.backup.measurements);
 assert.equal(objects.listedCount,1);assert.equal(objects.referencedCount,1);
 assert.equal(objects.downloadedBytes,blob.size);
 assert.deepEqual(calls.at(-1),['download',f.path]);
 const orders=[],db={from(){
  return{select(){return this;},order(field){orders.push(field);return this;},async range(){return{data:[{park_id:2,user_id:'owner'}]};}};
 }};
 const rows=await DG_BACKUP_PAGED_STORE.loadComplete(db,'park_collaborators',['park_id','user_id']);
 assert.equal(rows.length,1);
 assert.deepEqual(orders,['park_id','user_id']);
});

test('Fotoğraflı Tam Veri Arşivi: SQL contains all 13 tables without deleting or overwriting rows',()=>{
 const f=fixture();
 const sql=f.sql;
 for(const tab of ['profiles','parks','projects','measurements','waypoints','data_requests','surface_reviews',
  'report_requests','report_retractions','park_invites','park_collaborators','site_metric_daily','site_visits'])
  assert.ok(sql.includes('-- '+tab+' ('),tab);
 assert.match(sql,/INSERT INTO public\.measurements/);
 assert.match(sql,/ON CONFLICT DO NOTHING/);
 assert.doesNotMatch(sql,/\bDELETE FROM\b|\bTRUNCATE\b|\bDROP TABLE\b/);
 assert.equal(DG_BUILD_RESTORE_SQL.buildComplete(f.backup,DG_BACKUP_SQL_VALUE.serialize).tables,13);
});
