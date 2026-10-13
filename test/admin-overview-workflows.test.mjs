import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/adapters/admin/admin-overview-store.js',
 'src/domain/admin/summarize-admin-overview.js',
 'src/ui/admin-overview-metrics.js',
 'src/ui/admin-overview-measurements.js',
 'src/application/admin/load-admin-overview.js'
];
function load(){
 const window={},context=vm.createContext({window,Promise,Number,String,Object,Array});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 return window;
}

test('admin overview store preserves query filters, relationship key, order and count read',async()=>{
 const api=load(),calls=[];
 const results={profiles:{data:[{id:'u1'},{id:'u2'}],error:null},measurements:{data:[{id:'m1'}],error:null},projects:{data:[{id:'p1'}],error:null},v_global:{data:{carbon_t:7},error:null},count:{count:19}};
 const client={from(table){calls.push(['from',table]);let countRead=false;const q={select(...args){calls.push(['select',table,...args]);countRead=!!(args[1]&&args[1].head);return q;},order(...args){calls.push(['order',table,...args]);return q;},single(){return Promise.resolve(results[table]);},then(resolve){return Promise.resolve(countRead?results.count:results[table]).then(resolve);}};return q;}};
 const result=await api.DG_ADMIN_OVERVIEW_STORE.create(()=>client).load();
 assert.equal(result.users.data.length,2);assert.equal(result.measurementCount.count,19);
 assert.ok(calls.some(c=>c[0]==='select'&&c[1]==='measurements'&&c[2]==='*,profiles!measurements_owner_fkey(full_name)'));
 assert.ok(calls.some(c=>c[0]==='order'&&c[1]==='measurements'&&c[2]==='created_at'&&c[3].ascending===false));
 assert.ok(calls.some(c=>c[0]==='select'&&c[1]==='measurements'&&c[3]?.head===true));
});

test('admin overview summary prefers the exact count and keeps zero-carbon fallback',()=>{
 const api=load();
 assert.deepEqual(JSON.parse(JSON.stringify(api.DG_ADMIN_OVERVIEW_SUMMARY.summarize({users:[1,2],measurements:[1],projects:[1,2,3],global:{carbon_t:0},measurementCount:0}))),{users:2,records:0,projects:3,carbon:0});
 assert.deepEqual(JSON.parse(JSON.stringify(api.DG_ADMIN_OVERVIEW_SUMMARY.summarize({users:[],measurements:[1,2],projects:[],global:{}}))),{users:0,records:2,projects:0,carbon:0});
});

test('admin overview metrics update the existing four summary fields',()=>{
 const api=load(),elements=new Map(['aUsers','aRec','aProj','aCarbon'].map(id=>[id,{textContent:''}]));
 api.DG_ADMIN_OVERVIEW_METRICS_UI.render({users:2,records:19,projects:3,carbon:7},id=>elements.get(id));
 assert.deepEqual(Object.fromEntries([...elements].map(([id,el])=>[id,el.textContent])),{aUsers:2,aRec:19,aProj:3,aCarbon:7});
});

test('admin measurement panel escapes query errors and delegates successful rows',()=>{
 const api=load(),table={innerHTML:'old'},events=[];
 api.DG_ADMIN_OVERVIEW_MEASUREMENTS_UI.render({error:{message:'<denied>'}},[],{getElement:id=>id==='aMeasT'?table:null,escape:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),renderTable:rows=>events.push(rows)});
 assert.match(table.innerHTML,/&lt;denied&gt;/);assert.deepEqual(events,[]);
 api.DG_ADMIN_OVERVIEW_MEASUREMENTS_UI.render({error:null},[{id:'m1'}],{getElement:()=>table,escape:String,renderTable:rows=>events.push(rows)});
 assert.equal(events[0][0].id,'m1');
});

test('admin overview application keeps role gate and refresh side-effect order',async()=>{
 const api=load(),events=[],data={users:[],measurements:[],projects:[],global:{},measurementCount:null};
 const ports={load:async()=>{events.push('load');return{users:{data:[]},measurements:{data:[]},projects:{data:[]},global:{data:{}},measurementCount:{count:0}};},summarize:value=>({...value,summary:true}),updateMetrics:value=>events.push(['metrics',value.summary]),renderMeasurements:()=>events.push('measurements'),refreshBasePanels:()=>events.push('panels'),refreshTree:()=>events.push('tree'),refreshParkAdmin:()=>events.push('parks'),refreshPublicationQueue:()=>events.push('publication')};
 await api.DG_LOAD_ADMIN_OVERVIEW.execute({role:'user'},ports);assert.deepEqual(events,[]);
 await api.DG_LOAD_ADMIN_OVERVIEW.execute({role:'admin'},ports);
 assert.deepEqual(events,['load',['metrics',true],'measurements','panels','tree','parks','publication']);
});
