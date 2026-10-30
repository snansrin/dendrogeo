import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sources=[
 'src/domain/export/shared-park-inventory-domain.js',
 'src/adapters/export/shared-park-inventory-store.js',
 'src/ui/shared-park-inventory-export.js'
];
const storageOrigin='https://example.supabase.co';
function app(){
 const document={readyState:'loading',addEventListener(){}};
 const window={document,URL,Blob,DG_EXPORT_MEASUREMENT_STORE:{create:()=>({load:async()=>[]})}};
 const context=vm.createContext({window,document,URL,Blob,Date,Number,Math,Map,Set,Option:function(){},console});
 for(const file of sources)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 return window.DG_SHARED_PARK_INVENTORY_EXPORT;
}
function fixture(count=77){
 return Array.from({length:count},(_,i)=>({
  id:i+1,point_id:i+1,measurement_no:1,project_id:25,
  owner:i<10?'sinan':'nagihan',species:'Söğüt',grp:'YAPRAKLI',girth_cm:94.2,
  dbh_cm:30,height_m:8,carbon_kg:100,agb_kg:120,bhb_kg:40,
  lat:39.94,lon:32.8,created_at:'2026-10-31T08:00:00Z',status:'Onaylı',
  photo_url:`${storageOrigin}/storage/v1/object/public/dendro-photos/sinan/${i+1}.jpg`
 }));
}

test('shared park document keeps all 77 measurements from two owners in numeric Point ID order',()=>{
 const api=app(),group=api.groupProjects([{id:25,park_id:8,name:'Göksu Parkı saha',parks:{name:'Göksu Parkı',area_m2:501000}}]).get('park:8');
 const rows=fixture().reverse().sort(api.sortPoints);
 const html=api.documentHTML([{group,rows}],{latin:{Söğüt:'Salix alba'},origin:storageOrigin});
 assert.match(html,/Göksu Parkı/);
 assert.match(html,/👥 2 kişi · 📁 1 proje · 77 kayıt/);
 assert.match(html,/7\.70 t/);
 assert.match(html,/Point ID sıralı ayrıntılı envanter/);
 assert.ok(html.indexOf('P1</b>')<html.indexOf('P10</b>'));
 assert.ok(html.indexOf('P10</b>')<html.indexOf('P77</b>'));
 assert.equal((html.match(/Fotoğrafı aç<\/a>/g)||[]).length,77);
 assert.equal((html.match(/<img src=/g)||[]).length,77);
 assert.match(html,/Göğüs çevresi|Çevre \(cm\)/);
 assert.match(html,/Salix alba/);
 assert.match(html,/AGB:/);
 assert.match(html,/BHB:/);
});

test('same-park project groups are merged without disclosing unrelated parks',()=>{
 const api=app(),groups=api.groupProjects([
  {id:1,park_id:8,name:'Sinan',parks:{name:'Göksu Parkı'}},
  {id:2,park_id:8,name:'Nagihan',parks:{name:'Göksu Parkı'}},
  {id:3,park_id:13,name:'Başkent',parks:{name:'Başkent Millet Bahçesi'}}
 ]);
 assert.equal(groups.size,2);
 assert.deepEqual(Array.from(groups.get('park:8').projects,p=>p.id),[1,2]);
 assert.equal(groups.get('park:13').projects.length,1);
});

test('only trusted Supabase photo links are clickable and all DB text is escaped',()=>{
 const api=app(),group=api.groupProjects([{id:1,park_id:8,name:'Project',parks:{name:'Göksu <script>'}}]).get('park:8');
 const rows=fixture(2);
 rows[0].photo_url='javascript:alert(1)';
 rows[0].species='<img src=x onerror=alert(1)>';
 rows[1].photo_url='https://wrong.example/storage/v1/object/public/dendro-photos/a.jpg';
 const html=api.documentHTML([{group,rows}],{origin:storageOrigin});
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/<img src=x/);
 assert.doesNotMatch(html,/href="javascript:/);
 assert.doesNotMatch(html,/wrong\.example/);
 assert.equal((html.match(/Fotoğrafı aç<\/a>/g)||[]).length,0);
 assert.equal(api.photoURL(fixture(1)[0].photo_url,storageOrigin),fixture(1)[0].photo_url);
});

test('paginated measurement read does not truncate at 1000 and applies admin filters',async()=>{
 const api=app(),sourceRows=fixture(1017).reverse(),calls=[];
 const client={from(table){assert.equal(table,'measurements');return{
  select(){const filters=[];return{
   in(key,ids){assert.equal(key,'project_id');assert.deepEqual(Array.from(ids),[25,26]);return this;},
   eq(key,value){filters.push([key,value]);return this;},
   order(){return this;},
   async range(start,end){calls.push({start,end,filters});return{data:sourceRows.slice(start,end+1),error:null};}
  };}
 };}};
 const rows=await api.readAll(client,[25,26],{country:'Türkiye',status:'Onaylı'});
 assert.equal(rows.length,1017);
 assert.deepEqual(calls.map(c=>c.start),[0,1000]);
 assert.deepEqual(calls[0].filters,[['country','Türkiye'],['status','Onaylı']]);
 assert.equal(rows[0].point_id,1);
 assert.equal(rows.at(-1).point_id,1017);
});

test('project directory is paginated so full administrator export includes more than 1000 projects',async()=>{
 const api=app(),calls=[];
 const client={from(table){assert.equal(table,'projects');return{select(){return{
  order(column){assert.equal(column,'id');return this;},
  async range(start,end){calls.push(start);return{data:Array.from({length:Math.min(1017-start,end-start+1)},(_,i)=>({id:start+i+1,name:'Park'})),error:null};}
 };}};}};
 const projects=await api.listProjects(client);
 assert.equal(projects.length,1017);
 assert.deepEqual(calls,[0,1000]);
});

test('a failed page aborts the export instead of returning a misleading partial document',async()=>{
 const api=app(),query={
  in(){return this;},order(){return this;},
  async range(start){return start?{data:null,error:{message:'Yetki sona erdi'}}:{data:fixture(1000),error:null};}
 };
 const client={from(){return{select(){return query;}}}};
 await assert.rejects(()=>api.readAll(client,[25]),/Yetki sona erdi/);
});
