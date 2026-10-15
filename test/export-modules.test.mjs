import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/domain/export/measurement-row.js',
 'src/domain/export/build-measurement-csv.js',
 'src/domain/export/build-measurement-geojson.js',
 'src/adapters/export/measurement-store.js',
 'src/ui/export-preview.js'
];
function load(extra={}){
 const window={...extra};const context=vm.createContext({window,Date,Math,String,Number,Object,Array,Promise});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return{window,context};
}

test('measurement CSV row keeps 30-column order, raw girth, one-decimal DBH and safe quotes',()=>{
 const{window}=load(),FixedDate=class{constructor(value){this.value=value;}toLocaleDateString(locale){assert.equal(locale,'tr-TR');return'date';}toLocaleTimeString(){return'time';}toISOString(){return'2026-10-12T00:00:00.000Z';}};
 const row=window.DG_EXPORT_MEASUREMENT_ROW.build({point_id:7,measurement_no:2,created_at:'date',lat:39,lon:32,grp:'<leaf>',species:'Oak "A"',girth_cm:90,dbh_cm:28.647889,height_m:12,slope_deg:30,photo_url:'https://x.test/p.jpg'},
  {calculate:()=>({agb:100,bhb:25}),latin:{'Oak "A"':'Quercus "A"'},DateType:FixedDate});
 const columns=row.split(',');assert.equal(columns.length,30);assert.deepEqual(columns.slice(0,6),['7','2','date','time','39','32']);
 assert.equal(columns[11],'30');assert.equal(columns[12],'"<leaf>"');assert.equal(columns[13],'"Oak ""A"""');assert.equal(columns[14],'"Quercus ""A"""');
 assert.equal(columns[15],'90');assert.equal(columns[16],'28.6');assert.equal(columns[27],'P007_M2.JPG');assert.equal(columns[29],'2026-10-12');
});

test('measurement CSV builder preserves BOM, header, row order and final newline',()=>{
 const{window}=load(),csv=window.DG_BUILD_MEASUREMENT_CSV.build(['first','second'],'H1,H2',row=>row);
 assert.equal(csv,'\uFEFFH1,H2\nfirst\nsecond\n');
});

test('full and preview GeoJSON preserve [longitude, latitude] and their established properties',()=>{
 const{window}=load(),rows=[{lon:32,lat:39,point_id:4,species:'Oak',girth_cm:90,dbh_cm:28.647,height_m:12,carbon_kg:10,photo_url:'photo.jpg'}];
 const full=window.DG_BUILD_MEASUREMENT_GEOJSON.build(rows,{Oak:'Quercus'}),preview=window.DG_BUILD_MEASUREMENT_GEOJSON.build(rows,{}, {preview:true});
 assert.deepEqual(Array.from(full.features[0].geometry.coordinates),[32,39]);
 assert.deepEqual(JSON.parse(JSON.stringify(full.features[0].properties)),{point:4,species:'Oak',latin:'Quercus',circumference_cm:90,dbh:28.6,height:12,carbon:10,photo:'photo.jpg'});
 assert.deepEqual(JSON.parse(JSON.stringify(preview.features[0].properties)),{point:4,species:'Oak',carbon:10});
});

test('measurement store pages in 1000-row chunks and retains owner/order query',async()=>{
 const calls=[];let page=0;const client={from(table){calls.push(['from',table]);const q={select(value){calls.push(['select',value]);return q;},eq(...args){calls.push(['eq',...args]);return q;},order(...args){calls.push(['order',...args]);return q;},range(from,to){calls.push(['range',from,to]);return Promise.resolve({data:page++===0?Array.from({length:1000},(_,id)=>({id})): [{id:1000},{id:1001}]});}};return q;}};
 const{window}=load(),rows=await window.DG_EXPORT_MEASUREMENT_STORE.create(()=>client,()=> 'owner-1').load();
 assert.equal(rows.length,1002);assert.deepEqual(calls.filter(call=>call[0]==='range'),[['range',0,999],['range',1000,1999]]);
 assert.ok(calls.some(call=>call[0]==='eq'&&call[1]==='owner'&&call[2]==='owner-1'));
 assert.ok(calls.some(call=>call[0]==='order'&&call[1]==='created_at'&&call[2].ascending===false));
});

test('export preview renders bounded CSV rows or escaped truncated GeoJSON and calls existing download',()=>{
 const{window}=load(),calls=[],title={textContent:''},body={innerHTML:''},button={},modal={classList:{add:value=>calls.push(['modal',value]),remove:value=>calls.push(['close',value])}},elements=new Map([['pvTitle',title],['pvBody',body],['pvDownload',button],['previewModal',modal]]),document={getElementById:id=>elements.get(id)};
 const lines=['a,b',...Array.from({length:120},(_,index)=>`${index},<row>`)].join('\n');
 window.DG_EXPORT_PREVIEW_UI.render('CSV',lines,true,'report.csv',{document,escape:value=>String(value).replaceAll('<','&lt;'),download:(...args)=>calls.push(['download',...args])});
 assert.equal(title.textContent,'CSV');assert.equal((body.innerHTML.match(/<tr>/g)||[]).length,100);assert.match(body.innerHTML,/&lt;row>/);button.onclick();assert.equal(calls.find(call=>call[0]==='download')[0],'download');
 window.DG_EXPORT_PREVIEW_UI.render('GeoJSON','<x>'.repeat(7000),false,'report.geojson',{document,escape:value=>String(value).replaceAll('<','&lt;'),download:()=>{}});
 assert.equal((body.innerHTML.match(/&lt;/g)||[]).length,6667);assert.match(body.innerHTML,/<pre/);assert.equal(calls.at(-1)[1],'on');window.DG_EXPORT_PREVIEW_UI.close(document);assert.deepEqual(calls.at(-1),['close','on']);
});

test('export service delegates CSV, GeoJSON, paging and preview through the registered modules',async()=>{
 const{context,window}=load(),elements=new Map([['pvTitle',{textContent:''}],['pvBody',{innerHTML:''}],['pvDownload',{}],['previewModal',{classList:{add(value){this.value=value;}}}]]);
 context.document={getElementById:id=>elements.get(id)};
 Object.assign(context,{USER:{id:'owner-1'},LATIN:{Oak:'Quercus'},calc:()=>({agb:10,bhb:2}),esc:value=>String(value).replaceAll('<','&lt;'),$:id=>elements.get(id),
  sb:{from(){return{select(){return this;},eq(){return this;},order(){return this;},range(){return Promise.resolve({data:[{point_id:1,created_at:'2026-10-12T00:00:00Z',lat:39,lon:32,species:'Oak',dbh_cm:28.647,girth_cm:90,height_m:12,carbon_kg:5}]});}};}}});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../src/services/export.js',import.meta.url),'utf8'),context);
 const csv=vm.runInContext('fullCSV([{point_id:1,created_at:"2026-10-12T00:00:00Z",species:"Oak",dbh_cm:28.647}])',context);
 assert.ok(csv.startsWith('\uFEFFPOINT_ID,MEASUREMENT_NO'));assert.match(csv,/28\.6/);
 const rows=await vm.runInContext('getMine()',context);assert.equal(rows.length,1);
 vm.runInContext('openPreview("CSV",fullCSV([]),true,"x.csv")',context);assert.equal(elements.get('pvTitle').textContent,'CSV');assert.equal(elements.get('previewModal').classList.value,'on');
 const geo=window.DG_BUILD_MEASUREMENT_GEOJSON.build(rows,context.LATIN);assert.deepEqual(Array.from(geo.features[0].geometry.coordinates),[32,39]);
});
