import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sources=[
 'src/domain/trees/merge-measurement-projects.js',
 'src/adapters/trees/fetch-owned-measurement-projects.js',
 'src/adapters/trees/fetch-shared-measurement-projects.js',
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
function scopeClient({projects=[],memberships=[],invites=[],profiles=[],user=null}={}){
 const data={projects,park_collaborators:memberships,park_invites:invites,profiles,
  v_my_parks:memberships.map(row=>({id:row.park_id,role:'collaborator',name:`Park ${row.park_id}`}))},calls=[];
 return{
  calls,auth:{async getUser(){return{data:{user},error:null};}},
  from(table){assert.ok(Object.hasOwn(data,table),`unexpected read: ${table}`);return{
   select(){const clauses=[];const query={
    eq(field,value){clauses.push(row=>row[field]===value);return this;},
    in(field,values){clauses.push(row=>values.includes(row[field]));return this;},
    order(){return this;},
    async range(from,to){calls.push({table,from,to});return{data:data[table].filter(row=>clauses.every(p=>p(row))).slice(from,to+1),error:null};},
    then(resolve,reject){calls.push({table,from:null});return Promise.resolve({data:data[table].filter(row=>clauses.every(p=>p(row))),error:null}).then(resolve,reject);}
   };return query;}
  };}
 };
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

test('waypoint CSV project choices include owned and accepted shared projects, not unrelated projects',async()=>{
 const api=app(),client=scopeClient({projects:[
  {id:25,owner:'sinan',park_id:8,name:'Saha A',parks:{name:'Göksu Parkı'}},
  {id:26,owner:'nagihan',park_id:8,name:'Saha B',parks:{name:'Göksu Parkı'}},
  {id:30,owner:'sinan',park_id:9,name:'Saha C',parks:{name:'Başkent Parkı'}},
  {id:32,owner:'sinan',park_id:9,name:'Başkent Parkı',parks:{name:'Başkent Parkı'}},
  {id:31,owner:'outsider',park_id:10,name:'İzinsiz',parks:{name:'Özel Park'}}
 ],memberships:[{park_id:8,user_id:'sinan',added_at:'2026-10-30T10:00:00Z'}],
 invites:[{park_id:8,invited_by:'nagihan',email:'sinan@example.org',status:'Kabul',responded_at:'2026-10-30T11:00:00Z'}],
 profiles:[{id:'nagihan',role:'user',active:true}],
 user:{id:'sinan',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'}
 });
 const eligible=await api.listParticipantProjects(client,{userId:'sinan',role:'user'}),groups=api.waypointProjectGroups(eligible,'sinan');
 assert.deepEqual(JSON.parse(JSON.stringify(Array.from(groups,group=>[group.key,group.name,group.projects.length]))),
  JSON.parse(JSON.stringify(Array.from(api.groupProjects(eligible).values(),group=>[group.key,group.name,group.projects.length]).sort((a,b)=>a[1].localeCompare(b[1],'tr')))));
 assert.deepEqual(JSON.parse(JSON.stringify(Array.from(groups,group=>[group.name,group.projects.map(entry=>[entry.project.id,entry.label])]))),[
  ['Başkent Parkı',[[32,'Proje #32 · Sana ait'],[30,'Saha C · #30 · Sana ait']]],
  ['Göksu Parkı',[[25,'Saha A · #25 · Sana ait'],[26,'Saha B · #26 · Ortak erişim']]]
 ]);
});

test('waypoint CSV rechecks participant access and reads exactly the selected owned or accepted shared project',async()=>{
 const api=app(),client=scopeClient({
  projects:[
   {id:25,owner:'sinan',park_id:8,name:'Saha A',parks:{name:'Göksu Parkı'}},
   {id:26,owner:'nagihan',park_id:8,name:'Saha B',parks:{name:'Göksu Parkı'}}
  ],
  memberships:[{park_id:8,user_id:'sinan',added_at:'2026-10-30T10:00:00Z'}],
  invites:[{park_id:8,invited_by:'nagihan',email:'sinan@example.org',status:'Kabul',responded_at:'2026-10-30T11:00:00Z'}],
  profiles:[{id:'nagihan',role:'user',active:true}],
  user:{id:'sinan',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'}
 });
 const reads=[],metadata=[],fetchWaypoints={async fetch(args){reads.push(args.projectId);return{data:[{project_id:args.projectId,wp_id:4,lat:39.9,lon:32.8,visited:true}],error:null};}},formats={waypointsCSV(rows,source){metadata.push(source);return `rows=${rows.length};wp=${rows[0].wp_id};project=${source.id}`;}};
 const shared=await api.buildWaypointCSV({client,userId:'sinan',role:'user',projectId:'26',fetchWaypoints,formats});
 assert.equal(shared.project.id,26);
 assert.equal(shared.csv,'rows=1;wp=4;project=26');
 const result=await api.buildWaypointCSV({client,userId:'sinan',role:'user',projectId:'25',
  fetchWaypoints,
  formats
 });
 assert.equal(result.project.id,25);
 assert.equal(result.csv,'rows=1;wp=4;project=25');
 assert.equal(result.count,1);
 assert.deepEqual(reads,[26,25]);
 assert.deepEqual(metadata.map(source=>[source.id,source.name,source.parkId,source.parkName]),[[26,'Saha B',8,'Göksu Parkı'],[25,'Saha A',8,'Göksu Parkı']]);
 await assert.rejects(()=>api.buildWaypointCSV({client,userId:'sinan',role:'user',projectId:'999',fetchWaypoints,formats}),/erişimin artık yok/);
});

test('waypoint CSV fails closed on mixed-project rows and a mismatched signed-in account',async()=>{
 const api=app(),user={id:'sinan',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'};
 const client=scopeClient({projects:[{id:25,owner:'sinan',park_id:8,name:'Saha A',parks:{name:'Göksu Parkı'}}],user});
 const formats={waypointsCSV(){assert.fail('mixed rows must never reach the CSV serializer');}};
 await assert.rejects(()=>api.buildWaypointCSV({client,userId:'sinan',role:'user',projectId:25,
  fetchWaypoints:{async fetch(){return{data:[{project_id:25,wp_id:1},{project_id:26,wp_id:2}],error:null};}},formats
 }),/Karışık CSV oluşturulmadı/);
 await assert.rejects(()=>api.buildWaypointCSV({client,userId:'different-user',role:'user',projectId:25,
  fetchWaypoints:{async fetch(){assert.fail('mismatched sessions must stop before waypoint reads');}},formats
 }),/Oturum doğrulanamadı/);
});

test('waypoint CSV controls occupy a full-width row in the existing export grid',()=>{
 const source=readFileSync(new URL('../src/ui/shared-park-inventory-export.js',import.meta.url),'utf8');
 assert.match(source,/find\(card=>card\.querySelector\("h3"\)\?\.textContent\.trim\(\)==="Standart CSV"\)/);
 assert.match(source,/section\.style\.gridColumn="1 \/ -1"/);
 assert.match(source,/createElement\("optgroup"\)/);
 assert.match(source,/CSV’ye proje kimliği ve adı eklenir/);
 assert.doesNotMatch(source,/exportGrid\.append\(card\)/);
 assert.match(source,/exportBody\.append\(section\)/,'Park · Tam Envanter remains in its own report section');
});

test('waypoint CSV denies revoked projects and stops when there are no points',async()=>{
 const api=app(),projects=[
  {id:25,owner:'sinan',park_id:8,name:'Owned',parks:{name:'Göksu Parkı'}},
  {id:26,owner:'nagihan',park_id:8,name:'Revoked',parks:{name:'Göksu Parkı'}}
 ],user={id:'sinan',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'};
 const revoked=scopeClient({projects,user});
 await assert.rejects(()=>api.buildWaypointCSV({client:revoked,userId:'sinan',role:'user',projectId:26,
  fetchWaypoints:{async fetch(){assert.fail('revoked access must not read waypoint data');}},formats:{waypointsCSV(){return'';}}
 }),/erişimin artık yok/);
 const owned=scopeClient({projects,user});
 await assert.rejects(()=>api.buildWaypointCSV({client:owned,userId:'sinan',role:'user',projectId:25,
  fetchWaypoints:{async fetch({projectId}){assert.equal(projectId,25);return{data:[],error:null};}},formats:{waypointsCSV(){return'';}}
 }),/dışa aktarılacak ölçüm noktası yok/);
});

test('administrator participant selector contains only own and verified partner projects, never the admin-wide directory',async()=>{
 const api=app(),who='sinan',partner='nagihan',other='outsider';
 const client=scopeClient({
  projects:[
   {id:1,owner:who,park_id:8,name:'Sinan saha',parks:{name:'Göksu Parkı'}},
   {id:2,owner:partner,park_id:8,name:'Nagihan saha',parks:{name:'Göksu Parkı'}},
   {id:3,owner:other,park_id:8,name:'İzinsiz aynı park',parks:{name:'Göksu Parkı'}},
   {id:4,owner:other,park_id:12,name:'Alakasız park',parks:{name:'Özel park'}}
  ],
  memberships:[{park_id:8,user_id:who,added_at:'2026-10-30T10:00:00Z'}],
  invites:[{park_id:8,invited_by:partner,email:'sinan@example.org',status:'Kabul',responded_at:'2026-10-30T10:00:00Z'}],
  profiles:[{id:partner,role:'user',active:true}],
  user:{id:who,email:'Sinan@Example.org',email_confirmed_at:'2026-10-01T00:00:00Z'}
 });
 const rows=await api.listParticipantProjects(client,{userId:who,role:'admin'});
 assert.deepEqual(Array.from(rows,p=>p.id).sort(),[1,2]);
 assert.equal(api.groupProjects(rows).size,1);
 assert.ok(client.calls.every(call=>call.table!=='measurements'));
});

test('revoked, unconfirmed or unrelated invitations cannot widen a shared selector',async()=>{
 const api=app(),projects=[{id:1,owner:'sinan',park_id:8},{id:2,owner:'nagihan',park_id:8}];
 for(const account of [
  {id:'sinan',email:'sinan@example.org',email_confirmed_at:null},
  {id:'different',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'}
 ]){
  const client=scopeClient({projects,memberships:[{park_id:8,user_id:'sinan',added_at:'2026-10-30T10:00:00Z'}],
   invites:[{park_id:8,invited_by:'nagihan',email:'sinan@example.org',status:'Kabul',responded_at:'2026-10-30T10:00:00Z'}],user:account});
  assert.deepEqual(Array.from(await api.listParticipantProjects(client,{userId:'sinan',role:'admin'}),p=>p.id),[1]);
 }
 const revoked=scopeClient({projects,user:{id:'sinan',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'}});
 assert.deepEqual(Array.from(await api.listParticipantProjects(revoked,{userId:'sinan',role:'admin'}),p=>p.id),[1]);
});

test('accepted invite older than current membership does not authorize a project',async()=>{
 const api=app(),client=scopeClient({
  projects:[{id:1,owner:'sinan',park_id:8},{id:2,owner:'nagihan',park_id:8}],
  memberships:[{park_id:8,user_id:'sinan',added_at:'2026-10-31T10:00:00Z'}],
  invites:[{park_id:8,invited_by:'nagihan',email:'sinan@example.org',status:'Kabul',responded_at:'2026-10-30T10:00:00Z'}],
  user:{id:'sinan',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'}
 });
 assert.deepEqual(Array.from(await api.listParticipantProjects(client,{userId:'sinan',role:'admin'}),p=>p.id),[1]);
});

test('participant export exactly follows project-owner invite matches instead of widening a park invite to every project',async()=>{
 const api=app(),base={
  projects:[{id:1,owner:'sinan',park_id:8,name:'Sahibim',parks:{name:'Dikmen Vadisi'}},{id:2,owner:'nagihan',park_id:8,name:'Ülkü',parks:{name:'Ülkü Spor Tesisi'}},{id:3,owner:'third',park_id:8,name:'İzinsiz proje',parks:{name:'Ülkü Spor Tesisi'}},{id:4,owner:'third',park_id:9}],
  memberships:[{park_id:8,user_id:'sinan',added_at:'2026-10-30T10:00:00Z'}],
  invites:[{park_id:8,invited_by:'manager',email:'sinan@example.org',status:'Kabul',responded_at:'2026-10-30T10:00:00Z'},{park_id:8,invited_by:'nagihan',email:'sinan@example.org',status:'Kabul',responded_at:'2026-10-30T10:00:00Z'}],
  user:{id:'sinan',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'}
 };
 const permitted=scopeClient({...base,profiles:[{id:'manager',role:'admin',active:true}]});
 assert.deepEqual(Array.from(await api.listParticipantProjects(permitted,{userId:'sinan',role:'admin'}),p=>p.id).sort(),[1,2]);
 const denied=scopeClient({...base,profiles:[{id:'manager',role:'admin',active:false}]});
 assert.deepEqual(Array.from(await api.listParticipantProjects(denied,{userId:'sinan',role:'admin'}),p=>p.id).sort(),[1,2]);
 assert.equal((await api.listProjects(permitted)).length,4,'administrator-only directory keeps the full accessible set');
});

test('large project sets use the same current project-directory scope',async()=>{
 const api=app(),projects=Array.from({length:1005},(_,i)=>({id:i+1,owner:'partner',park_id:8,name:`Saha ${i+1}`,parks:{name:'Göksu Parkı'}}));
 const client=scopeClient({projects,memberships:[{park_id:8,user_id:'sinan',added_at:'2026-10-30T10:00:00Z'}],
  invites:[{park_id:8,invited_by:'partner',email:'sinan@example.org',status:'Kabul',responded_at:'2026-10-30T11:00:00Z'}],
  user:{id:'sinan',email:'sinan@example.org',email_confirmed_at:'2026-10-01T00:00:00Z'}
 });
 const eligible=await api.listParticipantProjects(client,{userId:'sinan',role:'admin'});
 assert.equal(eligible.length,1005);
 assert.deepEqual(client.calls.filter(call=>call.table==='projects').map(call=>call.from),[null,null]);
 assert.ok(client.calls.every(call=>call.table!=='measurements'));
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

test('downloadable report has scoped DendroGeo identity and a non-publication notice',()=>{
 const api=app(),group=api.groupProjects([{id:25,park_id:8,name:'Göksu',parks:{name:'Göksu Parkı'}}]).get('park:8');
 const html=api.documentHTML([{group,rows:fixture(2)}],{origin:storageOrigin});
 assert.match(html,/DENDROGEO/);
 assert.match(html,/SAHA ENVANTER RAPORU/);
 assert.match(html,/Point ID sıralı ayrıntılı envanter/);
 assert.match(html,/dg-park-export-report/);
 assert.match(html,/bir DGR bilimsel yayın onayı, DOI kaydı veya doğrulama sertifikası değildir/);
 assert.equal((html.match(/Fotoğrafı aç<\/a>/g)||[]).length,2);
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
