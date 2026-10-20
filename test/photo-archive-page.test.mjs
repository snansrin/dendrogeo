import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
function boot({role='owner'}={}){
 const events=[],elems=new Map(),files=[],origin='https://fixture.supabase.co';
 const get=id=>{
  if(!elems.has(id)){
   const listeners=new Map();
   elems.set(id,{
    id,dataset:{},textContent:'',disabled:false,value:'',files:[],
    addEventListener(name,fn){listeners.set(name,fn);},
    dispatch(name){return listeners.get(name)?.();},
    click(){events.push(['click',id]);}
   });
  }
  return elems.get(id);
 };
 const downloadRefs=[];
 class BrowserURL extends URL{
  static createObjectURL(blob){downloadRefs.push(blob);return'blob:fixture-'+downloadRefs.length;}
  static revokeObjectURL(){}
 }
 const ctx={window:null,URL:BrowserURL,TextEncoder,TextDecoder,Uint8Array,DataView,Blob,crypto:webcrypto,
  document:{
   getElementById:get,
   createElement(){return{remove(){},click(){events.push(['download',this.download]);}};},
   body:{appendChild(){}}
  },
  localStorage:{setItem:(...args)=>events.push(['remember',...args])},
  setTimeout(){},
  confirm(){events.push('confirm');return true;}
 };
 let reads=0;
 const tableNames=['measurements','projects','waypoints','data_requests','parks','surface_reviews','profiles',
  'report_requests','report_retractions','park_invites','park_collaborators','site_metric_daily','site_visits'];
 const photoBytes=new Uint8Array([71,79,75,83,85]);
 const records=Object.fromEntries(tableNames.map(table=>[table,[]]));
 records.measurements=[{id:1,photo_url:origin+'/storage/v1/object/public/dendro-photos/u1/goksu.jpg'}];
 records.profiles=[{id:'u1',role}];
 ctx.sb={
  supabaseUrl:origin,
  auth:{async getUser(){return{data:{user:{id:'u1'}}};}},
  from(table){
   assert.ok(tableNames.includes(table));
   return{
    select(){return this;},order(){return this;},eq(){return this;},
    async single(){return{data:{role,full_name:'Owner'}};},
    async range(){reads++;return{data:records[table]};}
   };
  },
  storage:{from(bucket){
   assert.equal(bucket,'dendro-photos');
   return{
    async list(prefix){
     const names=prefix===''?[{name:'u1',id:null}]:[{name:'goksu.jpg',id:'obj',metadata:{size:photoBytes.length,mimetype:'image/jpeg'}}];
     return{data:names};
    },
    async download(path){
     assert.equal(path,'u1/goksu.jpg');
     return{data:new Blob([photoBytes])};
    }
   };
  }}
 };
 ctx.window=ctx;
 vm.createContext(ctx);
 for(const file of ['paged-store.js','build-snapshot.js','sql-value.js','build-restore-sql.js','zip-archive.js','app.js'])
  vm.runInContext(read('fotografli-tam-veri-arsivi/'+file),ctx,{filename:file});
 return{ctx,events,get,origin,downloadRefs,reads:()=>reads};
}

test('standalone photo archive page has proper assets, no implicit network or frozen main app edits',()=>{
 const html=read('fotografli-tam-veri-arsivi/index.html');
 assert.match(html,/<title>Fotoğraflı Tam Veri Arşivi · DendroGeo<\/title>/);
 assert.match(html,/<body class="dg-page">/);
 assert.match(html,/\.\.\/css\/ui-standard\.css/);
 assert.match(html,/src="app\.js"/);
 assert.match(html,/src="zip-archive\.js"/);
 assert.match(html,/id="dgArchiveDownload"/);
 assert.match(html,/id="dgArchiveRestorePick"/);
 assert.doesNotMatch(html,/<script(?![^>]*src=)/i);
});

test('page rejects unprivileged browser session before 13-table reads or downloading',async()=>{
 const state=boot({role:'user'});
 await state.get('dgArchiveDownload').dispatch('click');
 assert.equal(state.reads(),0);
 assert.match(state.get('dgArchiveStatus').textContent,/sahip \(owner\) hesabı/);
 assert.equal(state.downloadRefs.length,0);
});

test('page creates a verified 13-table ZIP and can prepare SQL from that ZIP without writing to Supabase',async()=>{
 const state=boot();
 await state.get('dgArchiveDownload').dispatch('click');
 assert.equal(state.reads(),13);
 assert.equal(state.downloadRefs.length,1);
 assert.match(state.events.find(x=>Array.isArray(x)&&x[0]==='download')[1],/fotografli_tam_veri_arsivi/);
 assert.match(state.get('dgArchiveStatus').textContent,/13 tab/);
 const blob=state.downloadRefs[0],parsed=await state.ctx.DG_BACKUP_JSON_DOWNLOAD.readComplete(state.ctx,blob);
 assert.equal(parsed.photos.length,1);
 assert.equal(parsed.backup.profiles.length,1);
 assert.equal(parsed.backup.counts.measurements,1);
 assert.equal(parsed.backup.storage.source_origin,state.origin);

 state.get('dgArchiveFile').files=[Object.assign(new Blob([await blob.arrayBuffer()]),{name:'verified.zip'})];
 await state.get('dgArchiveFile').dispatch('change');
 assert.equal(state.downloadRefs.length,2);
 assert.match(state.events.at(-1)[1],/geri_yukleme.*sql/);
 assert.match(state.get('dgArchiveStatus').textContent,/ZIP doğrulandı/);
 // No .insert(), .update(), .delete(), .upload() methods existed on mocks.
});
