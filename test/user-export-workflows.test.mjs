import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/domain/export/resolve-export-options.js',
 'src/application/export/serialize-measurement-export.js',
 'src/adapters/export/file-download.js',
 'src/application/export/download-user-measurement-export.js',
 'src/application/export/prepare-user-measurement-preview.js'
];
function load(){
 const window={},context=vm.createContext({window,Array,Object,String,JSON});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return window;
}

test('export options preserve current filenames, activity labels and preview titles',()=>{
 const api=load().DG_RESOLVE_EXPORT_OPTIONS;
 assert.deepEqual(JSON.parse(JSON.stringify(api.resolve('csv'))),{activity:'CSV',fileName:'dendrogeo.csv',previewTitle:'CSV Önizleme (ilk 100 satır)',isCSV:true});
 assert.deepEqual(JSON.parse(JSON.stringify(api.resolve('qgis'))),{activity:'QGIS',fileName:'dendrogeo_qgis.csv',previewTitle:'QGIS CSV Önizleme (ilk 100 satır)',isCSV:true});
 assert.deepEqual(JSON.parse(JSON.stringify(api.resolve('geojson'))),{activity:'GeoJSON',fileName:'dendrogeo.geojson',previewTitle:'GeoJSON Önizleme',isCSV:false});
 assert.equal(api.resolve('unknown'),null);
});

test('serializer sends CSV/QGIS and full or preview GeoJSON to the existing builders',()=>{
 const api=load().DG_SERIALIZE_MEASUREMENT_EXPORT,calls=[],rows=[{id:1}];
 assert.equal(api.serialize('csv',rows,{csv:value=>{calls.push(['csv',value]);return'csv-data';}}),'csv-data');
 assert.equal(api.serialize('qgis',rows,{csv:()=> 'qgis-data'}),'qgis-data');
 assert.deepEqual(JSON.parse(api.serialize('geojson',rows,{geojson:(value,preview)=>{calls.push(['geo',value,preview]);return{type:'FeatureCollection',features:[]};}})),{type:'FeatureCollection',features:[]});
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['csv',rows],['geo',rows,false]]);
 assert.throws(()=>api.serialize('unknown',rows,{}),/Bilinmeyen/);
});

test('download workflow preserves activity, load, serialize and download order',async()=>{
 const api=load().DG_DOWNLOAD_USER_MEASUREMENT_EXPORT,calls=[],rows=[{id:1},{id:2}];
 const result=await api.execute('qgis',{resolve:format=>({activity:'QGIS',fileName:'dendrogeo_qgis.csv'}),onActivity:value=>calls.push(['activity',value]),
  load:async()=>{calls.push('load');return rows;},serialize:(format,value,options)=>{calls.push(['serialize',format,value.length,options.preview]);return'csv';},download:(content,name)=>calls.push(['download',content,name])});
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['activity','QGIS'],'load',['serialize','qgis',2,false],['download','csv','dendrogeo_qgis.csv']]);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{format:'qgis',rows:2,content:'csv',fileName:'dendrogeo_qgis.csv'});
});

test('preview workflow returns the current presentation contract and only requests preview serialization',async()=>{
 const api=load().DG_PREPARE_USER_MEASUREMENT_PREVIEW,calls=[];
 const result=await api.execute('geojson',{resolve:()=>({previewTitle:'GeoJSON Önizleme',isCSV:false,fileName:'dendrogeo.geojson'}),load:async()=>[{id:1}],serialize:(format,rows,options)=>{calls.push([format,rows.length,options.preview]);return'{"type":"FeatureCollection"}';}});
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['geojson',1,true]]);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{title:'GeoJSON Önizleme',content:'{"type":"FeatureCollection"}',isCSV:false,fileName:'dendrogeo.geojson'});
 await assert.rejects(api.execute('qgis',{resolve:()=>({fileName:'x.csv'}),load:async()=>[],serialize:()=>''}),/Önizleme biçimi/);
});

test('download adapter retains Blob MIME, filename and click behavior',()=>{
 const api=load().DG_EXPORT_FILE_DOWNLOAD,calls=[],anchor={click:()=>calls.push('click')};
 class TestBlob{constructor(parts,options){this.parts=parts;this.options=options;}}
 api.download('content','dendrogeo.csv',{document:{createElement:tag=>{calls.push(['create',tag]);return anchor;}},URL:{createObjectURL:blob=>{calls.push(['url',blob.parts,blob.options]);return'blob:test';}},Blob:TestBlob});
 assert.equal(anchor.href,'blob:test');assert.equal(anchor.download,'dendrogeo.csv');
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['create','a'],['url',['content'],{type:'text/csv;charset=utf-8;'}],'click']);
});

test('export service delegates all user export and preview entry points',()=>{
 const source=readFileSync(new URL('../src/services/export.js',import.meta.url),'utf8');
 for(const api of ['DG_RESOLVE_EXPORT_OPTIONS','DG_SERIALIZE_MEASUREMENT_EXPORT','DG_DOWNLOAD_USER_MEASUREMENT_EXPORT','DG_PREPARE_USER_MEASUREMENT_PREVIEW','DG_EXPORT_FILE_DOWNLOAD'])assert.ok(source.includes('window.'+api));
 for(const entry of ['function exportCSV','function exportQgis','function exportGeo','function dl','function previewCSV','function previewGeo'])assert.ok(source.includes(entry));
});
