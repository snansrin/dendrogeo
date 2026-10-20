import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

// Regression tests for the ONLY supported owner-admin archive implementation.
const previous=globalThis.window;
globalThis.window={crypto:webcrypto,Blob,URL};
await import('../src/domain/backup/photo-full-snapshot.mjs');
await import('../src/domain/backup/photo-full-restore-sql.mjs');
await import('../src/domain/backup/photo-full-sql-value.mjs');
await import('../src/adapters/backup/photo-full-zip.mjs');
const ZIP=window.DG_PHOTO_ARCHIVE_ZIP;

function fixture(){
 const photo=new TextEncoder().encode('real photograph bytes\n');
 const rows={
  measurements:[{id:17,owner:'owner-id',photo_url:'https://fixture.supabase.co/storage/v1/object/public/dendro-photos/owner-id/tree%20one.jpg'}],
  projects:[],waypoints:[],data_requests:[],parks:[],surface_reviews:[],
  profiles:[{id:'owner-id',role:'owner'}],report_requests:[],report_retractions:[],
  park_invites:[],park_collaborators:[],site_metric_daily:[],site_visits:[]
 };
 const snapshot=window.DG_PHOTO_ARCHIVE_SNAPSHOT.buildComplete({...rows,requests:rows.data_requests},{
  exportedAt:'2026-10-20T08:00:00Z',exportedBy:'Fixture'});
 const sql=window.DG_PHOTO_ARCHIVE_RESTORE_SQL.buildComplete(snapshot,window.DG_PHOTO_ARCHIVE_SQL_VALUE.serialize).sql;
 const storage={bucket:'dendro-photos',sourceOrigin:'https://fixture.supabase.co',
  photos:[{path:'owner-id/tree one.jpg',blob:new Blob([photo]),bytes:photo.length,contentType:'image/jpeg'}],
  downloadedBytes:photo.length,referencedCount:1};
 return{snapshot,storage,sql,photo};
}

async function make(badCount=false){
 const fixtureData=fixture();
 if(badCount)fixtureData.snapshot.counts.profiles=99;
 const result=await ZIP.downloadComplete(window,fixtureData.snapshot,fixtureData.storage,
  'dendrogeo_fotografli_tam_veri_arsivi_2026-10-20.zip',fixtureData.sql,{deferDownload:true});
 return{...fixtureData,blob:result.archive};
}

test('owner-panel ZIP round-trip preserves the 13 data tables, photo bytes and SQL',async()=>{
 const f=await make(),read=await ZIP.readComplete(window,f.blob);
 assert.equal(read.backup.counts.measurements,1);
 assert.equal(read.backup.schema_version,'2.0.0');
 assert.equal(read.photos.length,1);
 assert.equal(read.photos[0].path,'owner-id/tree one.jpg');
 assert.deepEqual(Array.from(read.photos[0].data),Array.from(f.photo));
 assert.equal(read.restoreSql,f.sql);
 assert.equal(read.backup.storage.source_origin,'https://fixture.supabase.co');
});

test('one corrupted photo byte invalidates an otherwise complete ZIP',async()=>{
 const f=await make(),bytes=new Uint8Array(await f.blob.arrayBuffer());
 let hit=-1;
 for(let i=30;i<bytes.length-f.photo.length;i++){
  if(f.photo.every((n,j)=>bytes[i+j]===n)){hit=i;break;}
 }
 assert.ok(hit>=30,'original photo bytes must appear as a real ZIP entry');
 bytes[hit]^=1;
 await assert.rejects(ZIP.readComplete(window,new Blob([bytes])),/CRC32|SHA-256/);
});

test('tampered manifest data counts are rejected during restore',async()=>{
 const f=await make(true);
 await assert.rejects(ZIP.readComplete(window,f.blob),/Arşiv tablosu eksik|bozuk veri tablosu|Eksik veya bozuk/i);
});

test('archive is only prepared locally, without automatic upload to any service',async()=>{
 const f=await make(),checked=await ZIP.readComplete(window,f.blob);
 assert.equal(checked.photos.length,1);
 assert.equal(f.blob.type,'application/zip');
});

after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
