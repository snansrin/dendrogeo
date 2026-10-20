import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
 TABLES,collectRecords,collectPhotoObjects,downloadPhotos,
 assembleArchive,zipStored,sqlRestore,makeFullArchive
} from '../tam-yedek/archive.mjs';

const PHOTO='https://x.supabase.co/storage/v1/object/public/dendro-photos/owner/1.jpg';
function fixture({missing=false,brokenPhoto=false}={}){
 const counts=[],downloads=[],lists=[],tables={};
 for(const [name] of TABLES)tables[name]=[];
 tables.measurements=[{id:3,photo_url:PHOTO,owner:'user-1',dbh_cm:42.5,carbon_kg:1234.5}];
 tables.parks=[{id:25,name:"O'Brien Park"}];
 const photos={
  '':[{name:'owner',id:null,metadata:null}],
  'owner':missing?[]:[{name:'1.jpg',id:'photo-1',metadata:{size:3,mimetype:'image/jpeg'}}]
 };
 return{counts,downloads,lists,tables,client:{
  from(table){
   return{select(value){assert.equal(value,'*');return this;},order(){return this;},
    async range(start,end){counts.push([table,start,end]);return{data:tables[table].slice(start,end+1),error:null};}};
  },
  storage:{from(bucket){
   assert.equal(bucket,'dendro-photos');
   return{
    async list(prefix,opts){lists.push([prefix,opts.offset,opts.limit]);return{data:(photos[prefix]||[]).slice(opts.offset,opts.offset+opts.limit),error:null};},
    async download(path){downloads.push(path);return brokenPhoto?{data:null,error:{message:'offline'}}:{data:new Blob(['abc']),error:null};}
   };
  }}
 }};
}
function readZipEntries(blob){
 return blob.arrayBuffer().then(buffer=>{
  const view=new DataView(buffer),data=new Uint8Array(buffer),decoder=new TextDecoder();
  let offset=0;const entries={};
  while(offset+30<=buffer.byteLength&&view.getUint32(offset,true)===0x04034b50){
   const length=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
   const size=view.getUint32(offset+18,true);
   const filename=decoder.decode(data.slice(offset+30,offset+30+length));
   const begin=offset+30+length+extra;
   entries[filename]=data.slice(begin,begin+size);
   offset=begin+size;
  }
  assert.equal(view.getUint32(offset,true),0x02014b50);
  assert.equal(view.getUint32(buffer.byteLength-22,true),0x06054b50);
  return entries;
 });
}

test('collects 13 complete RLS-visible tables with correct unique ordering',async()=>{
 const f=fixture();const data=await collectRecords(f.client);
 assert.equal(Object.keys(data).length,13);
 assert.equal(data.measurements.length,1);
 assert.deepEqual(f.counts.map(x=>x[0]),TABLES.map(x=>x[0]));
});
test('paginates database results beyond 1000 without dropping rows',async()=>{
 const f=fixture();
 f.tables.waypoints=Array.from({length:1001},(_,id)=>({id}));
 const data=await collectRecords(f.client);
 assert.equal(data.waypoints.length,1001);
 assert.deepEqual(f.counts.filter(call=>call[0]==='waypoints').map(x=>x.slice(1)),[[0,999],[1000,1999]]);
});
test('finds linked photos recursively, downloads exact bytes once, and checks size',async()=>{
 const f=fixture(),inventory=await collectPhotoObjects(f.client,f.tables.measurements);
 assert.equal(inventory.objects.length,1);
 assert.equal(inventory.referenceCount,1);
 const data=await downloadPhotos(inventory);
 assert.equal(data.bytes,3);
 assert.equal(data.photos.length,1);
 assert.deepEqual(f.downloads,['owner/1.jpg']);
 assert.deepEqual(f.lists,[['',0,100],['owner',0,100]]);
});
test('refuses missing photos, failed downloads and external photo URLs',async()=>{
 const missing=fixture({missing:true});
 await assert.rejects(collectPhotoObjects(missing.client,missing.tables.measurements),/Storage içinde eksik/);
 const failing=fixture({brokenPhoto:true}),inventory=await collectPhotoObjects(failing.client,failing.tables.measurements);
 await assert.rejects(downloadPhotos(inventory),/Fotoğraf indirilemedi/);
 const external=fixture();external.tables.measurements[0].photo_url='https://other.example/remote.jpg';
 await assert.rejects(collectPhotoObjects(external.client,external.tables.measurements),/Yedeklenemeyen fotoğraf/);
});
test('writes a verifiable ZIP of data, real photo bytes and SQL recovery hints',async()=>{
 const f=fixture(),archive=await makeFullArchive(f.client,{cryptoImpl:webcrypto});
 assert.equal(archive.photos,1);
 const entries=await readZipEntries(archive.blob);
 for(const expected of ['README.txt','data/backup.json','restore/primary-tables.sql','storage/dendro-photos/owner/1.jpg','integrity.json'])assert.ok(entries[expected],expected);
 assert.equal(new TextDecoder().decode(entries['storage/dendro-photos/owner/1.jpg']),'abc');
 const backup=JSON.parse(new TextDecoder().decode(entries['data/backup.json']));
 assert.equal(backup.schema_version,'2.0.0');
 assert.equal(backup.counts.measurements,1);
 assert.equal(backup.storage.downloaded_photo_count,1);
 assert.equal(backup.scope.complete_system_backup,false);
 assert.equal(backup.scope.photo_file_bytes_included,true);
 const integrity=JSON.parse(new TextDecoder().decode(entries['integrity.json']));
 assert.equal(integrity.entries.length,4);
 for(const item of integrity.entries){
  const bytes=entries[item.name];
  const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
  assert.equal(digest,item.sha256,item.name);
 }
 const sql=new TextDecoder().decode(entries['restore/primary-tables.sql']);
 assert.match(sql,/INSERT INTO public\.measurements/);
 assert.match(sql,/O''Brien Park/);
 assert.doesNotMatch(sql,/INSERT INTO public\.site_visits/);
});
test('SQL generator escapes quoted values and only imports safe fixed table names',()=>{
 const f=fixture(),sql=sqlRestore(f.tables,'2026-10-20');
 assert.match(sql,/O''Brien Park/);
 assert.equal(sql.split('COMMIT;').length,2);
 assert.ok(sql.includes('ON CONFLICT DO NOTHING;'));
});
test('ZIP builder rejects traversal paths and duplicate file names',()=>{
 assert.throws(()=>zipStored([{name:'../secret',bytes:new Uint8Array(0)}]),/Storage dosya yolu/);
 assert.throws(()=>zipStored([{name:'data/file',bytes:new Uint8Array(0)},{name:'data/file',bytes:new Uint8Array(0)}]),/ZIP dosyası tekrarlandı/);
});
test('schema and protected production data are not changed by archive assembly',async()=>{
 const f=fixture();const before=JSON.stringify(f.tables);
 const photoData={photos:[],bytes:0,referenceCount:0};
 await assembleArchive(f.tables,photoData,{cryptoImpl:webcrypto});
 assert.equal(JSON.stringify(f.tables),before);
});
