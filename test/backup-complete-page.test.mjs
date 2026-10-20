import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const previous=globalThis.window;
globalThis.window={crypto:webcrypto,Blob,URL};
await import('../src/adapters/backup/photo-full-paged-store.mjs');
await import('../src/domain/backup/photo-full-snapshot.mjs');
await import('../src/domain/backup/photo-full-restore-sql.mjs');
await import('../src/domain/backup/photo-full-sql-value.mjs');
const store=window.DG_PHOTO_ARCHIVE_PAGED_STORE;

function fixture({missing=false,offline=false,external=false}={}){
 const origin='https://fixture.supabase.co',reads=[],lists=[],downloads=[],data={
  measurements:[{id:4,photo_url:external?'https://other.example/remote.jpg':origin+'/storage/v1/object/public/dendro-photos/owner/photo%20one.jpg'}],
  waypoints:[],profiles:[{id:'owner'}],projects:[],parks:[],data_requests:[],surface_reviews:[],
  report_requests:[],report_retractions:[],park_invites:[],park_collaborators:[],site_metric_daily:[],site_visits:[]
 };
 const client={
  supabaseUrl:origin,
  from(table){return{
   select(){return this;},order(){return this;},
   async range(start,end){reads.push([table,start,end]);return{data:data[table].slice(start,end+1)};}
  };},
  storage:{from(bucket){
   assert.equal(bucket,'dendro-photos');
   return{
    async list(folder,opts){lists.push([folder,opts.offset,opts.limit]);return{data:
     folder===''?[{name:'owner',id:null}]:
     missing?[]:[{name:'photo one.jpg',id:'p1',metadata:{size:3,mimetype:'image/jpeg'}}]};
    },
    async download(path){downloads.push(path);return offline?{error:{message:'offline'}}:{data:new Blob(['abc'])};}
   };
  }}
 };
 return{client,data,reads,lists,downloads};
}

test('supported admin reader paginates 13 full tables, including composite-key ordering',async()=>{
 const f=fixture(),plan=[
  ['measurements',['created_at','id']],['projects',['id']],['waypoints',['id']],
  ['data_requests',['id']],['parks',['id']],['surface_reviews',['park_id','owner']],
  ['profiles',['id']],['report_requests',['id']],['report_retractions',['id']],
  ['park_invites',['id']],['park_collaborators',['park_id','user_id']],
  ['site_metric_daily',['day','event','page','source','device','country']],['site_visits',['id']]
 ];
 for(const [table,columns] of plan)await store.loadComplete(f.client,table,columns);
 assert.deepEqual(f.reads.map(r=>r[0]),plan.map(p=>p[0]));
});

test('supported admin reader carries all records across its 500-row page boundary',async()=>{
 const f=fixture();f.data.waypoints=Array.from({length:1001},(_,id)=>({id}));
 const out=await store.loadComplete(f.client,'waypoints',['id']);
 assert.equal(out.length,1001);
 assert.deepEqual(f.reads.filter(x=>x[0]==='waypoints').map(x=>x.slice(1)),
  [[0,499],[500,999],[1000,1499]]);
});

test('photo inventory resolves URL-encoded spaces and downloads exact photo bytes',async()=>{
 const f=fixture(),x=await store.archivePhotos(f.client,'dendro-photos',f.data.measurements);
 assert.equal(x.referencedCount,1);
 assert.equal(x.listedCount,1);
 assert.equal(x.photos.length,1);
 assert.equal(x.downloadedBytes,3);
 assert.equal(x.photos[0].path,'owner/photo one.jpg');
 assert.deepEqual(f.downloads,['owner/photo one.jpg']);
 assert.deepEqual(f.lists,[['',0,100],['owner',0,100]]);
});

test('missing photos, remote URLs and failed Storage downloads abort instead of claiming a valid backup',async()=>{
 const missing=fixture({missing:true});
 await assert.rejects(store.archivePhotos(missing.client,'dendro-photos',missing.data.measurements),/Storage listesinde bulunamadı/);
 assert.deepEqual(missing.downloads,[]);
 const external=fixture({external:true});
 await assert.rejects(store.archivePhotos(external.client,'dendro-photos',external.data.measurements),/arşivlenemeyen fotoğraf bağlantısı/);
 const failed=fixture({offline:true});
 await assert.rejects(store.archivePhotos(failed.client,'dendro-photos',failed.data.measurements),/Fotoğraf indirilemedi/);
});

test('owner archive snapshot retains 13 tables; SQL escapes quote values without destructive updates',()=>{
 const f=fixture();f.data.parks=[{id:5,name:"O'Brien Park"}];
 const original=JSON.stringify(f.data);
 const snapshot=window.DG_PHOTO_ARCHIVE_SNAPSHOT.buildComplete({...f.data,requests:f.data.data_requests},
  {exportedAt:'2026-10-20T08:00:00Z',exportedBy:'Fixture'});
 const sql=window.DG_PHOTO_ARCHIVE_RESTORE_SQL.buildComplete(snapshot,window.DG_PHOTO_ARCHIVE_SQL_VALUE.serialize);
 assert.equal(sql.tables,13);
 assert.match(sql.sql,/O''Brien Park/);
 assert.match(sql.sql,/ON CONFLICT DO NOTHING/);
 assert.doesNotMatch(sql.sql,/\b(?:TRUNCATE|DROP TABLE|DELETE FROM)\b/);
 assert.equal(JSON.stringify(f.data),original);
});
after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
