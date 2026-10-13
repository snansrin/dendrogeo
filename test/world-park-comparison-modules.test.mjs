import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/adapters/world/park-comparison-store.js',
 'src/domain/parks/prepare-park-comparison.js',
 'src/domain/parks/group-legacy-park-comparison.js',
 'src/ui/legacy-park-comparison.js',
 'src/application/world/zoom-to-location.js'
];
function load(){
 const window={},context=vm.createContext({window,Date,Math,String,Number,Object,Array,Promise});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return{window,context};
}

test('park comparison adapter preserves primary, legacy and location query contracts',async()=>{
 const calls=[],client={from(table){calls.push(['from',table]);const q={select(...args){calls.push(['select',...args]);return q;},order(...args){calls.push(['order',...args]);return q;},eq(...args){calls.push(['eq',...args]);return q;},limit(value){calls.push(['limit',value]);return q;},then(resolve){return Promise.resolve({data:[],count:0,error:null}).then(resolve);}};return q;}};
 const{window}=load(),store=window.DG_WORLD_PARK_COMPARISON_STORE.create(()=>client);
 await store.primary();await store.legacy();await store.location('country','TR');
 assert.deepEqual(calls.filter(call=>call[0]==='from'),[['from','v_park_compare'],['from','measurements'],['from','measurements']]);
 assert.ok(calls.some(call=>call[0]==='order'&&call[1]==='carbon_kg'&&call[2].ascending===false));
 assert.ok(calls.some(call=>call[0]==='select'&&call[1]==='carbon_kg,dbh_cm,height_m,species,grp,projects(name,city)'&&call[2].count==='exact'));
 assert.ok(calls.some(call=>call[0]==='eq'&&call[1]==='country'&&call[2]==='TR'));
 assert.deepEqual(calls.filter(call=>call[0]==='limit'),[['limit',5000],['limit',2000]]);
});

test('park comparison preparation separates pending rows without changing the input',()=>{
 const{window}=load(),rows=[{park_id:3,carbon_kg:10},{park_id:0,carbon_kg:999},{park_id:2,carbon_kg:20}],before=JSON.stringify(rows);
 const result=window.DG_PREPARE_PARK_COMPARISON.prepare(rows);
 assert.deepEqual(Array.from(result.linked,row=>row.park_id),[3,2]);assert.deepEqual(Array.from(result.pending,row=>row.park_id),[0]);assert.equal(result.max,20);assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(JSON.parse(JSON.stringify(window.DG_PREPARE_PARK_COMPARISON.prepare([]))),{linked:[],pending:[],max:1});
});

test('legacy comparison groups, sums and sorts by project carbon',()=>{
 const{window}=load(),result=window.DG_GROUP_LEGACY_PARK_COMPARISON.group([{carbon_kg:5,dbh_cm:10,height_m:2,projects:{name:'A',city:'Ankara'}},{carbon_kg:10,dbh_cm:20,height_m:4,projects:{name:'B',city:'Izmir'}},{carbon_kg:7,dbh_cm:30,height_m:6,projects:{name:'A',city:'Ankara'}}]);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{parks:[{name:'A',city:'Ankara',n:2,c:12,dbh:40,h:8},{name:'B',city:'Izmir',n:1,c:10,dbh:20,h:4}],max:12});
});

test('legacy comparison UI preserves fallback warning, escaped project rows and report options',()=>{
 const{window}=load(),escape=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),translate=value=>'en:'+value;
 const parks=[{name:'<Park>',city:'<City>',n:2,c:1500,dbh:24,h:8}];
 const html=window.DG_LEGACY_PARK_COMPARISON_UI.render(parks,1500,{escape,translate});
 assert.match(html,/şeması eski/);assert.match(html,/&lt;Park&gt;/);assert.match(html,/&lt;City&gt;/);assert.match(html,/en:kayıt/);assert.match(html,/1\.50 t/);
 assert.equal(window.DG_LEGACY_PARK_COMPARISON_UI.reportOptions(parks,escape),'<option>proj:&lt;Park&gt;</option>');
 assert.match(window.DG_LEGACY_PARK_COMPARISON_UI.render([],1,{escape,translate}),/Henüz onaylı kayıt yok/);
});

test('location zoom keeps no-map guard, warning limit and fit order',async()=>{
 const{window}=load(),events=[],map={};
 await window.DG_WORLD_ZOOM_TO_LOCATION.run(null,'city','Ankara','Ankara','🏙',{load:()=>{throw Error('no map should stop');}});
 await window.DG_WORLD_ZOOM_TO_LOCATION.run(map,'city','Ankara','Ankara','🏙',{load:async(column,value)=>{events.push(['load',column,value]);return{data:[{lat:39,lon:32}],count:2501};},warnIfTruncated:(rows,limit,label,count)=>events.push(['warn',rows.length,limit,label,count]),fit:(...args)=>events.push(['fit',...args])});
 assert.deepEqual(events.map(event=>event[0]),['load','warn','fit']);assert.equal(events[1][2],2000);assert.equal(events[1][4],2501);assert.deepEqual(events[2],['fit',map,[{lat:39,lon:32}],'Ankara','🏙']);
});

test('world service delegates the primary park query and partition to extracted modules',async()=>{
 const{window,context}=load(),events=[],parkBox={innerHTML:''},reportBox={innerHTML:''};
 window.DG_PARK_COMPARISON_ROW={render:(park)=>`<article>${park.park_name}</article>`};
 window.DG_PARK_COMPARISON_PENDING={render:rows=>`<aside>${rows.length} pending</aside>`};
 window.DG_PARK_REPORT_OPTIONS_UI={render:(target,linked,pending)=>{target.innerHTML=`${linked.length}/${pending.length}`;}};
 const client={from(table){events.push(['from',table]);const q={select(){return q;},order(column,options){events.push(['order',column,options]);return q;},then(resolve){return Promise.resolve({data:[{park_id:5,park_name:'Main',carbon_kg:4},{park_id:0,park_name:'Pending',carbon_kg:2}],error:null}).then(resolve);}};return q;}};
 Object.assign(context,{sb:client,$:id=>id==='parkCompare'?parkBox:id==='repProject'?reportBox:null,esc:String,dgFmtHa:value=>String(value),dgIsSchemaError:()=>false,toast:()=>{}});
 vm.runInContext(readFileSync(new URL('../src/services/world.js',import.meta.url),'utf8'),context);
 await vm.runInContext('loadParkCompare()',context);
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['from','v_park_compare'],['order','carbon_kg',{ascending:false}]]);
 assert.equal(parkBox.innerHTML,'<article>Main</article><aside>1 pending</aside>');assert.equal(reportBox.innerHTML,'1/1');
});
