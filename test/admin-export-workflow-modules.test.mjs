import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/ui/admin-measurement-filter.js',
 'src/ui/fill-admin-export-select.js',
 'src/application/admin/load-admin-export-filters.js',
 'src/application/admin/update-admin-export-filter-options.js',
 'src/application/admin/download-admin-measurements.js'
];
function load(){
 const window={},context=vm.createContext({window,Promise,Object,Array,String});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return window;
}

test('admin measurement filter keeps case-insensitive row matching and visibility styles',()=>{
 const api=load().DG_ADMIN_MEASUREMENT_FILTER,rows=[{textContent:'Karaçam Ankara',style:{}},{textContent:'Meşe İzmir',style:{}}],events=[];
 api.apply('ANKARA',{querySelectorAll:selector=>{events.push(selector);return rows;}});
 assert.deepEqual(events,['tr']);assert.deepEqual(rows.map(row=>row.style.display),['','none']);
});

test('admin export select preserves current choice, escapes values, and ignores a missing element',()=>{
 const api=load().DG_FILL_ADMIN_EXPORT_SELECT;let value='TR';const select={get value(){return value;},set value(next){value=next;},innerHTML:''};
 api.render(select,['TR',{v:'2',label:'<Park>'}],text=>String(text).replaceAll('<','&lt;').replaceAll('>','&gt;'));
 assert.match(select.innerHTML,/value="TR" selected/);assert.match(select.innerHTML,/&lt;Park&gt;/);assert.equal(value,'TR');api.render(null,[],String);
});

test('admin export filter loader applies rows after the parallel query and absorbs transport failure',async()=>{
 const api=load().DG_LOAD_ADMIN_EXPORT_FILTERS,events=[];
 await api.execute({load:async()=>[{data:[{country:'TR'}]},{data:[{id:3}]}],apply:(rows,projects)=>events.push([rows.data.length,projects.data.length])});
 assert.deepEqual(events,[[1,1]]);
 await assert.doesNotReject(api.execute({load:async()=>{throw Error('offline');},apply:()=>assert.fail('failed query applied')}));
});

test('admin export cascading filters update city before projects and preserve project IDs',()=>{
 const api=load().DG_UPDATE_ADMIN_EXPORT_FILTER_OPTIONS,events=[];
 api.countryChanged(['row'],['project'],'Türkiye',{listCities:(...args)=>{events.push(['cities',...args]);return['Ankara'];},fillCity:values=>events.push(['city-options',values]),cityChanged:()=>events.push(['city-change'])});
 api.cityChanged(['project'],'Türkiye','Ankara',{listProjects:(...args)=>{events.push(['projects',...args]);return[{v:'7',label:'Park · Ankara'}];},fillProject:values=>events.push(['project-options',values])});
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['cities',['row'],['project'],'Türkiye'],['city-options',['Ankara']],['city-change'],['projects',['project'],'Türkiye','Ankara',true],['project-options',[{v:'7',label:'Park · Ankara'}]]]);
});

test('admin download workflows retain CSV/QGIS/GeoJSON names, empty behavior and success notices',async()=>{
 const api=load().DG_DOWNLOAD_ADMIN_MEASUREMENTS,events=[],ports={read:async()=>[{id:1}],csv:rows=>'CSV:'+rows.length,geojson:rows=>({features:rows}),download:(...args)=>events.push(['download',...args]),onEmpty:format=>events.push(['empty',format]),onSuccess:(...args)=>events.push(['success',...args])};
 await api.execute('csv',ports);await api.execute('qgis',ports);await api.execute('geojson',ports);
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[
  ['download','CSV:1','dendrogeo_toplu.csv'],['success','csv',1],
  ['download','CSV:1','dendrogeo_qgis_detayli.csv'],['success','qgis',1],
  ['download','{\n  "features": [\n    {\n      "id": 1\n    }\n  ]\n}','dendrogeo_toplu.geojson'],['success','geojson',1]
 ]);
 await api.execute('csv',{...ports,read:async()=>[],onEmpty:format=>events.push(['empty',format])});assert.deepEqual(events.at(-1),['empty','csv']);
});

test('admin service delegates all five export/filter responsibilities and retains compatibility bodies',()=>{
 const source=readFileSync(new URL('../src/services/admin.js',import.meta.url),'utf8');
 for(const api of ['DG_ADMIN_MEASUREMENT_FILTER','DG_FILL_ADMIN_EXPORT_SELECT','DG_LOAD_ADMIN_EXPORT_FILTERS','DG_UPDATE_ADMIN_EXPORT_FILTER_OPTIONS','DG_DOWNLOAD_ADMIN_MEASUREMENTS'])assert.ok(source.includes('window.'+api));
 for(const entry of ['function filterAdminMeas','function fillSelect','async function loadAdminExportFilters','function admCountryChanged','function admCityChanged','async function adminExportCSV','async function adminExportQgis','async function adminExportGeo'])assert.ok(source.includes(entry));
});
