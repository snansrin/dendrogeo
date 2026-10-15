import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(paths){const window={};for(const path of paths)vm.runInNewContext(read(path),{window});return window;}
const modules=['src/domain/parks/identity.js','src/adapters/parks/project-link-store.js','src/domain/parks/build-backfill-project-link.js',
 'src/application/parks/link-backfill-project-to-park.js','src/ui/park-backfill-link-feedback.js','src/application/parks/refresh-after-park-backfill.js'];

test('backfill project link payload keeps the canonical legacy project label',()=>{
 const api=load(modules).DG_BUILD_BACKFILL_PROJECT_LINK;
 assert.deepEqual(JSON.parse(JSON.stringify(api.build({id:3,name:'Kuzey Kesim Envanteri'},{id:7,name:'Göksu Parkı'}))),
  {park_id:7,label:'Kuzey Kesim Envanteri'});
 assert.deepEqual(JSON.parse(JSON.stringify(api.build({name:'Göksu Parkı'},{id:7,name:'Göksu Parkı'}))),{park_id:7,label:''});
});

test('backfill link writes the project first and treats measurement denormalization as best effort',async()=>{
 const api=load(modules).DG_LINK_BACKFILL_PROJECT_TO_PARK,events=[];
 const link=api.create({buildPatch:()=>({park_id:7,label:'label'}),
  updateProject:async(id,patch)=>{events.push(['project',id,patch]);return{error:null};},
  backfillMeasurements:async(id,park)=>{events.push(['measurements',id,park]);throw Error('best effort');}});
 const result=await link({id:3},{id:7});
 assert.equal(result.status,'linked');
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['project',3,{park_id:7,label:'label'}],['measurements',3,7]]);
});

test('backfill adapter preserves its UPDATE-only project query and null-only measurement fill',async()=>{
 const events=[],client={from(table){events.push(['from',table]);return{
  update(value){events.push(['update',value]);return this;},eq(...args){events.push(['eq',...args]);return this;},is(...args){events.push(['is',...args]);return this;}
 };}};
 const store=load(modules).DG_PARK_PROJECT_LINK_STORE_ADAPTER.create({getClient:()=>client});
 await store.updateBackfillProject(3,{park_id:7,label:'label'});
 await store.backfillMeasurements(3,7);
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[
  ['from','projects'],['update',{park_id:7,label:'label'}],['eq','id',3],
  ['from','measurements'],['update',{park_id:7}],['eq','project_id',3],['is','park_id',null]
 ]);
});

test('failed project link reports failure and never starts measurement backfill',async()=>{
 const api=load(modules).DG_LINK_BACKFILL_PROJECT_TO_PARK,error={message:'denied'};let measurements=0;
 const link=api.create({buildPatch:()=>({}),updateProject:async()=>({error}),backfillMeasurements:async()=>{measurements++;}});
 const result=await link({id:3},{id:7});
 assert.equal(result.status,'write-failed');assert.equal(result.error,error);assert.equal(measurements,0);
});

test('backfill feedback keeps escaped error reporting and refresh order',()=>{
 const window=load(modules),events=[];
 window.DG_PARK_BACKFILL_LINK_FEEDBACK_UI.failed({project:{name:'<Project>'},error:{message:'<denied>'},escape:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),translate:value=>'T:'+value,warn:(...args)=>events.push(['warn',...args]),notify:(...args)=>events.push(['toast',...args])});
 window.DG_REFRESH_AFTER_PARK_BACKFILL.refresh({loadProjects:()=>events.push('projects'),loadWorld:()=>events.push('world'),loadAdmin:()=>events.push('admin')});
 assert.deepEqual(events.map(value=>Array.isArray(value)?value[0]:value),['warn','toast','projects','world','admin']);
 assert.equal(events[1][1],'T:Bağlanamadı (&lt;Project&gt;): &lt;denied&gt;');
});

test('five backfill modules load before locked park service and are precached',()=>{
 const head=read('partials/head.html'),sw=read('sw.js'),controller=read('src/bootstrap/park-backfill-controller.js'),service=read('src/services/park-registry.js');
 for(const path of ['src/domain/parks/identity.js','src/domain/parks/build-backfill-project-link.js','src/application/parks/link-backfill-project-to-park.js','src/ui/park-backfill-link-feedback.js','src/application/parks/refresh-after-park-backfill.js']){
  assert.ok(head.indexOf(path)<head.indexOf('src/services/park-registry.js'));assert.ok(sw.includes('/'+path));
 }
 for(const api of ['DG_BUILD_BACKFILL_PROJECT_LINK','DG_LINK_BACKFILL_PROJECT_TO_PARK','DG_REFRESH_AFTER_PARK_BACKFILL'])assert.ok(service.includes(api));
 assert.ok(controller.includes('DG_PARK_BACKFILL_LINK_FEEDBACK_UI'));
});
