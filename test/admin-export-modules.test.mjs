import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/ui/admin-measurement-row.js',
 'src/ui/admin-measurement-table.js',
 'src/domain/admin/export-filter-options.js',
 'src/application/admin/build-export-query.js',
 'src/application/admin/read-export-rows.js'
];
function app(){
 const window={};
 const context=vm.createContext({window});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 return{window,run:code=>vm.runInContext(code,context)};
}

test('admin measurement row and table preserve moderation markup, escaping and point order',()=>{
 const {window}=app();
 const escape=value=>String(value??'').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const rows=[
  {id:2,project_id:2,point_id:4,measurement_no:1,species:'<Meşe>',profiles:{full_name:'<Ada>'},status:'Beklemede',dbh_cm:12.345,height_m:4,carbon_kg:5,photo_url:null},
  {id:1,project_id:1,point_id:9,measurement_no:1,species:'Çam',profiles:{full_name:'Can'},status:'Onaylı',dbh_cm:30,height_m:8,carbon_kg:9,photo_url:null}
 ];
 const renderRow=row=>window.DG_ADMIN_MEASUREMENT_ROW_UI.render(row,{escape,latin:{},thumbnail:()=>''});
 const html=window.DG_ADMIN_MEASUREMENT_TABLE_UI.render(rows,{renderRow});
 assert.ok(html.indexOf('data-mid="1"')<html.indexOf('data-mid="2"'));
 assert.match(html,/&lt;Ada&gt;/);
 assert.match(html,/onclick="approveMeas\(2\)"/);
 assert.match(html,/onclick="rejectMeas\(1\)"/);
 assert.match(html,/12\.3/);
 assert.match(window.DG_ADMIN_MEASUREMENT_TABLE_UI.render([],{renderRow}),/Kayıt yok/);
});

test('admin export options merge project and measurement locations and retain cascading filters',()=>{
 const {window}=app(),options=window.DG_ADMIN_EXPORT_FILTER_OPTIONS;
 const rows=[{country:'Türkiye',city:'İzmir'},{country:'Türkiye',city:'Ankara'}];
 const projects=[{id:2,name:'B Park',country:'Türkiye',city:'Ankara'},{id:1,name:'A Park',country:'Türkiye',city:'Ankara'},{id:3,name:'Elsewhere',country:'Türkiye',city:'İzmir'}];
 assert.deepEqual(Array.from(options.listCountries(rows,projects)),['Türkiye']);
 assert.deepEqual(Array.from(options.listCities(rows,projects,'Türkiye')),['Ankara','İzmir']);
 assert.deepEqual(JSON.parse(JSON.stringify(options.listProjects(projects,'Türkiye','Ankara',true))),[
  {v:'1',label:'A Park · Ankara'},{v:'2',label:'B Park · Ankara'}
 ]);
});

test('admin export query applies only selected filters and paged reads stop at final partial page',async()=>{
 const {window}=app(),calls=[];
 const query={from(table){calls.push(['from',table]);return this;},select(columns){calls.push(['select',columns]);return this;},eq(column,value){calls.push(['eq',column,value]);return this;}};
 window.DG_BUILD_ADMIN_EXPORT_QUERY.build(()=>query,{country:'Türkiye',city:'Ankara',project:'7',status:'Onaylı'});
 assert.deepEqual(calls,[['from','measurements'],['select','*,projects(name)'],['eq','country','Türkiye'],['eq','city','Ankara'],['eq','project_id',7],['eq','status','Onaylı']]);
 const ranges=[];
 const rows=await window.DG_READ_ADMIN_EXPORT_ROWS.read(()=>({order(column){assert.equal(column,'created_at');return this;},range(from,to){ranges.push([from,to]);const data=from===0?Array.from({length:2},(_,id)=>({id})): [{id:2}];return Promise.resolve({data,error:null});}}),{pageSize:2});
 assert.deepEqual(ranges,[[0,1],[2,3]]);
 assert.equal(rows.length,3);
 await assert.rejects(window.DG_READ_ADMIN_EXPORT_ROWS.read(()=>({order(){return this;},range(){return Promise.resolve({data:null,error:{message:'denied'}});}})),/denied/);
});
