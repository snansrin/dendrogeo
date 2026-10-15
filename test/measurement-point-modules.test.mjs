import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/adapters/trees/fetch-unvisited-measurement-waypoints.js',
  'src/adapters/trees/fetch-latest-measurement-point.js',
  'src/application/trees/suggest-next-measurement-point.js',
  'src/adapters/trees/fetch-measurement-at-project-point.js',
  'src/ui/measurement-point-query-result.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('waypoint and latest-point adapters preserve project filters and next-id query',async()=>{
  const{window}=setup(),calls=[];
  const client={from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);const query={eq(field,value){calls.push(['eq',field,value]);if(table==='waypoints'&&field==='visited')return Promise.resolve({data:[{wp_id:2}]});return query;},order(field,options){calls.push(['order',field,options]);return query;},limit(value){calls.push(['limit',value]);return Promise.resolve({data:[{point_id:7}]});}};return query;}};}};
  const waypoints=await window.DG_FETCH_UNVISITED_MEASUREMENT_WAYPOINTS.fetch({client,projectId:4});
  const latest=await window.DG_FETCH_LATEST_MEASUREMENT_POINT.fetch({client,projectId:4});
  assert.deepEqual(JSON.parse(JSON.stringify(waypoints)),[{wp_id:2}]);assert.deepEqual(JSON.parse(JSON.stringify(latest)),{point_id:7});
  assert.deepEqual(calls.slice(0,5),[['from','waypoints'],['select','*'],['eq','project_id',4],['eq','visited',false],['from','measurements']]);
  assert.equal(JSON.stringify(calls.slice(5)),JSON.stringify([['select','point_id'],['eq','project_id',4],['order','point_id',{ascending:false}],['limit',1]]));
});

test('next-point suggestion chooses nearest waypoint and protects current form state',async()=>{
  const{window}=setup(),assigned=[];let can=true;
  const ports={canStart:()=>true,projectId:()=>3,pointValue:()=>'',gps:()=>({latitude:0,longitude:0}),canSuggest:()=>can,fetchWaypoints:async()=>[{wp_id:8,lat:10,lon:10},{wp_id:2,lat:1,lon:1}],fetchLatest:async()=>({point_id:12}),distance:(a,b,c,d)=>Math.hypot(a-c,b-d),setPoint:value=>assigned.push(value)};
  await window.DG_SUGGEST_NEXT_MEASUREMENT_POINT.suggest(ports);assert.deepEqual(assigned,[2]);
  ports.fetchWaypoints=async()=>[];await window.DG_SUGGEST_NEXT_MEASUREMENT_POINT.suggest(ports);assert.deepEqual(assigned,[2,13]);
  ports.fetchLatest=async()=>null;can=false;await window.DG_SUGGEST_NEXT_MEASUREMENT_POINT.suggest(ports);assert.deepEqual(assigned,[2,13]);
});

test('late next-point suggestion cannot overwrite manual input after an async read',async()=>{
  const{window}=setup();let resolve,manual=false,value='';
  const pending=window.DG_SUGGEST_NEXT_MEASUREMENT_POINT.suggest({canStart:()=>true,projectId:()=>9,pointValue:()=>value,gps:()=>null,canSuggest:()=>!manual&&!value,fetchWaypoints:async()=>[],fetchLatest:()=>new Promise(done=>{resolve=done;}),distance:()=>0,setPoint:next=>{value=next;}});
  manual=true;value='99';resolve({point_id:5});await pending;assert.equal(value,'99');
});

test('point-record adapter preserves the latest project and point query shape',async()=>{
  const{window}=setup(),calls=[];
  const client={from:table=>{calls.push(['from',table]);return{select:columns=>{calls.push(['select',columns]);const query={eq:(field,value)=>{calls.push(['eq',field,value]);return query;},order:(field,options)=>{calls.push(['order',field,options]);return query;},limit:value=>{calls.push(['limit',value]);return Promise.resolve({data:[{id:1}]});}};return query;}};}};
  assert.deepEqual(JSON.parse(JSON.stringify(await window.DG_FETCH_MEASUREMENT_AT_PROJECT_POINT.fetch({client,projectId:4,pointId:6}))),{id:1});
  assert.equal(JSON.stringify(calls),JSON.stringify([['from','measurements'],['select','*'],['eq','project_id',4],['eq','point_id',6],['order','created_at',{ascending:false}],['limit',1]]));
});

test('point query result escapes external text and keeps the empty-state copy',()=>{
  const{window}=setup(),element={innerHTML:'',className:'',style:{}};
  window.DG_MEASUREMENT_POINT_QUERY_RESULT.render({element,pointId:5,record:null,escape:String,translate:value=>value,translateFormat:(value,data)=>value.replace('{p}',data.p),circumferenceFromDiameter:()=>null});
  assert.equal(element.innerHTML,'ℹ P5 için kayıt yok · Yeni kayıt oluşturulacak.');
  window.DG_MEASUREMENT_POINT_QUERY_RESULT.render({element,record:{id:4,point_id:5,species:'<oak>',girth_cm:50,dbh_cm:10,height_m:8,carbon_kg:3,status:'<pending>',photo_url:'<img>'},escape:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),translate:value=>value,translateFormat:value=>value,circumferenceFromDiameter:()=>null});
  assert.match(element.innerHTML,/&lt;oak&gt;/);assert.match(element.innerHTML,/&lt;img&gt;/);assert.doesNotMatch(element.innerHTML,/<img>/);assert.match(element.innerHTML,/data-point-query-action="edit" data-record-id="4"/);assert.doesNotMatch(element.innerHTML,/\bonclick\s*=/i);
});

test('point query edit/delete buttons use owner callbacks through delegated events',()=>{
  const{window}=setup(),listeners={},calls=[],element={innerHTML:'',className:'',style:{},addEventListener:(name,handler)=>{listeners[name]=handler;},contains:()=>true};
  window.DG_MEASUREMENT_POINT_QUERY_RESULT.render({element,record:{id:4,point_id:5,species:'Oak',dbh_cm:10,height_m:8,carbon_kg:3},escape:String,translate:value=>value,translateFormat:value=>value,circumferenceFromDiameter:()=>null,actions:{edit:id=>calls.push(['edit',id]),delete:id=>calls.push(['delete',id])}});
  for(const action of ['edit','delete']){const button={dataset:{pointQueryAction:action,recordId:'4'}};listeners.click({target:{closest:selector=>selector==='[data-point-query-action]'?button:null}});}
  assert.deepEqual(calls,[['edit',4],['delete',4]]);
});

test('five point-workflow modules load before measure.js and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  const source=read('src/services/measure.js');for(const token of ['DG_SUGGEST_NEXT_MEASUREMENT_POINT','DG_FETCH_UNVISITED_MEASUREMENT_WAYPOINTS','DG_FETCH_LATEST_MEASUREMENT_POINT','DG_FETCH_MEASUREMENT_AT_PROJECT_POINT','DG_MEASUREMENT_POINT_QUERY_RESULT'])assert.ok(source.includes(token),token);
});
