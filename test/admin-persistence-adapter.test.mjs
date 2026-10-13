import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {findDirectPersistenceAccess} from '../scripts/lib/dependency-direct-persistence.mjs';

function load(){
 const window={},context=vm.createContext({window});
 vm.runInContext(readFileSync(new URL('../src/adapters/admin/admin-persistence-store.js',import.meta.url),'utf8'),context);
 return window.DG_ADMIN_PERSISTENCE_STORE;
}

test('admin persistence adapter preserves measurement query and photo storage contracts',async()=>{
 const calls=[];
 const storage={from(bucket){calls.push(['storage',bucket]);return{
  list(path,options){calls.push(['list',path,options.limit]);return Promise.resolve({data:[]});},
  getPublicUrl(path){calls.push(['url',path]);return{data:{publicUrl:'https://cdn/'+path}};},
  remove(paths){calls.push(['remove',paths]);return Promise.resolve({error:null});}
 };}};
 const client={storage,from(table){calls.push(['from',table]);return{select(...args){calls.push(['select',...args]);if(args[0]==='photo_url')return Promise.resolve({data:[],error:null});if(args[1]?.head)return{eq(...filter){calls.push(['eq',...filter]);return Promise.resolve({count:4,error:null});}};const query={eq(...filter){calls.push(['eq',...filter]);return query;}};return query;}};}};
 const store=load().create(()=>client);
 assert.deepEqual(await store.loadMeasurementPhotoUrls(),[]);
 await store.countPendingMeasurements();
 store.buildMeasurementExportQuery({country:'TR',city:'Ankara',project:'7',status:'Onaylı'});
 await store.listPhotoFiles('dendro-photos','',100);
 assert.equal(store.getPhotoPublicUrl('dendro-photos','u1/a.jpg'),'https://cdn/u1/a.jpg');
 await store.removePhotoFiles('dendro-photos',['u1/a.jpg']);
 const plainCalls=JSON.parse(JSON.stringify(calls));
 assert.deepEqual(plainCalls.slice(0,2),[['from','measurements'],['select','photo_url']]);
 assert.deepEqual(plainCalls.slice(2,5),[['from','measurements'],['select','*',{count:'exact',head:true}],['eq','status','Beklemede']]);
 assert.deepEqual(plainCalls.slice(5,11),[['from','measurements'],['select','*,projects(name)'],['eq','country','TR'],['eq','city','Ankara'],['eq','project_id',7],['eq','status','Onaylı']]);
 assert.deepEqual(plainCalls.slice(11),[['storage','dendro-photos'],['list','',100],['storage','dendro-photos'],['url','u1/a.jpg'],['storage','dendro-photos'],['remove',['u1/a.jpg']]]);
});

test('admin photo adapters reject failed or incomplete reference and Storage reads',async()=>{
 const adapter=load(),queryError=Error('permission denied');
 const queryStore=adapter.create(()=>({storage:{},from:()=>({select:async()=>({data:null,error:queryError})})}));
 await assert.rejects(queryStore.loadMeasurementPhotoUrls(),error=>error===queryError);
 const storageStore=adapter.create(()=>({storage:{from:()=>({list:async()=>({data:null,error:null})})},from(){}}));
 await assert.rejects(storageStore.listPhotoFiles('dendro-photos','',100),/listesi doğrulanamadı/);
});

test('application persistence boundary rejects direct Supabase clients',()=>{
 const modules=[
  {layer:'application',relativePath:'src/application/example.js',source:'client.from("measurements"); storage.from("photos");'},
  {layer:'adapters',relativePath:'src/adapters/example.js',source:'client.from("measurements");'}
 ];
 assert.deepEqual(findDirectPersistenceAccess(modules),[
  'src/application/example.js:1: application must access Supabase through an adapter port',
  'src/application/example.js:1: application must access Supabase through an adapter port'
 ]);
});
