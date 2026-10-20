import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const previous=globalThis.window;
globalThis.window={crypto:webcrypto,Blob,URL};
const flow=await import('../src/application/backup/photo-full-workflow.mjs');

function fixture(role='owner',broken=false){
 const origin='https://fixture.supabase.co',events=[];
 const bytes=new Uint8Array([255,216,255,0,8,217]);
 const data={
  measurements:[{id:1,photo_url:origin+'/storage/v1/object/public/dendro-photos/owner/goksu%20photo.jpg'}],
  projects:[{id:42}],waypoints:[],data_requests:[],parks:[],surface_reviews:[],
  profiles:[{id:'owner',role}],report_requests:[],report_retractions:[],
  park_invites:[],park_collaborators:[],site_metric_daily:[],site_visits:[]
 };
 const client={
  supabaseUrl:origin,
  auth:{async getUser(){events.push('getUser');return{data:{user:{id:'owner'}}};}},
  from(table){
   events.push('from:'+table);
   return{select(){return this;},eq(){return this;},order(){return this;},
    async single(){return{data:{role,full_name:'Fixture'}};},
    async range(offset,end){events.push('read:'+table);return{data:data[table].slice(offset,end+1)};}
   };
  },
  storage:{from(bucket){
   assert.equal(bucket,'dendro-photos');
   return{
    async list(folder){
     events.push('list:'+folder);
     if(folder==='')return{data:[{name:'owner',id:null}]};
     return{data:broken?[]:[{name:'goksu photo.jpg',id:'photo-1',metadata:{size:bytes.length,mimetype:'image/jpeg'}}]};
    },
    async download(path){
     events.push('download:'+path);
     assert.equal(path,'owner/goksu photo.jpg');
     return{data:new Blob([bytes])};
    }
   };
  }}
 };
 return{client,events,bytes};
}

test('rejects a non-owner BEFORE reading user tables or photos',async()=>{
 const f=fixture('admin');
 await assert.rejects(flow.makeOwnerArchive(f.client),/yalnız DendroGeo sahip/);
 assert.deepEqual(f.events,['getUser','from:profiles']);
});

test('owner obtains 13 RLS-visible tables with exactly one real photo; ZIP passes SHA-256 verification before download',async()=>{
 const f=fixture('owner');
 const exported=await flow.makeOwnerArchive(f.client,{now:()=> '2026-10-20T05:00:00.000Z'});
 assert.match(exported.filename,/dendrogeo_fotografli_tam_veri_arsivi_2026-10-20\.zip/);
 assert.equal(exported.photos,1);
 assert.equal(exported.counts.measurements,1);
 assert.equal(f.events.filter(x=>x.startsWith('read:')).length,13);
 assert.equal(f.events.filter(x=>x.startsWith('download:')).length,1);
 const verified=await window.DG_PHOTO_ARCHIVE_ZIP.readComplete(window,exported.blob);
 assert.equal(verified.photos[0].path,'owner/goksu photo.jpg');
 assert.deepEqual(Array.from(verified.photos[0].data),Array.from(f.bytes));
 assert.equal(verified.backup.storage.downloaded_photo_count,1);
 assert.equal(verified.backup.storage.source_origin,f.client.supabaseUrl);
 const restored=await flow.inspectOwnerArchive(f.client,exported.blob);
 assert.equal(restored.measurements,1);
 assert.equal(restored.photos,1);
 assert.match(restored.sql,/INSERT INTO public\.measurements/);
 assert.match(restored.sql,/ON CONFLICT DO NOTHING/);
});

test('fails closed when an inventory photo is unavailable without producing partial archive',async()=>{
 const f=fixture('owner',true);
 await assert.rejects(flow.makeOwnerArchive(f.client),/Storage listesinde bulunamadı/);
 assert.equal(f.events.some(x=>x.startsWith('download:')),false);
});

test.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
