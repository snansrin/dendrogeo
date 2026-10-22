import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/domain/parks/summarize-park-report.js','src/ui/park-report-summary.js',
 'src/ui/park-report-species-table.js','src/domain/parks/build-park-report-csv.js',
 'src/ui/park-report-preview.js'
];
function app(){const window={},ctx=vm.createContext({window});for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});return window;}
const rows=[
 {species:'Meşe',grp:'YAPRAKLI',carbon_kg:100,dbh_cm:20,height_m:8,projects:{name:'Göksu - A'}},
 {species:'Çam',grp:'İBRELİ',carbon_kg:300,dbh_cm:40,height_m:12,projects:{name:'Göksu - B'}}
];

test('park report summary preserves averages, groups, species order and area intensity',()=>{
 const model=app().DG_SUMMARIZE_PARK_REPORT.summarize(rows,{park_id:7,city:'Ankara',area_m2:10000,contributors:3},2);
 assert.deepEqual(JSON.parse(JSON.stringify(model)),{
  count:2,carbon:400,dbh:'30.0',height:'10.0',conifers:1,broadleaf:1,
  species:[['Çam',{count:1,carbon:300,dbh:40,height:12,group:'İBRELİ'}],['Meşe',{count:1,carbon:100,dbh:20,height:8,group:'YAPRAKLI'}]],
  projects:['Göksu - A','Göksu - B'],area:10000,carbonPerHa:0.4,contributors:3,reportCount:2,parkId:7,city:'Ankara',coniferPercent:'50.0',broadleafPercent:'50.0'
 });
});

test('park report UI keeps cards, species labels, translated header and CSV identity',()=>{
 const w=app(),model=w.DG_SUMMARIZE_PARK_REPORT.summarize(rows,{park_id:7,city:'Ankara',area_m2:10000,contributors:3},2);
 const summary=w.DG_PARK_REPORT_SUMMARY_UI.render('Göksu Parkı',model,{escape:value=>String(value),translate:value=>value,formatHa:()=> '1.0 ha',date:'13.10.2026'});
 const table=w.DG_PARK_REPORT_SPECIES_TABLE.render(model.species,{Çam:'Pinus',Meşe:'Quercus'});
 const csv=w.DG_BUILD_PARK_REPORT_CSV.build('Göksu Parkı',model,{date:'13.10.2026',latin:{Çam:'Pinus',Meşe:'Quercus'}});
 assert.match(summary,/Göksu Parkı/);assert.match(summary,/0\.40 t/);assert.match(summary,/50\.0/);assert.match(summary,/birleşen projeler/);
 assert.match(table,/<th scope='col'>Tür<\/th>/);assert.ok(table.indexOf('Çam')<table.indexOf('Meşe'));
 assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/PARK_ID,7/);assert.match(csv,/KARBON_T_HA,0\.400/);assert.match(csv,/Çam,Pinus,İBRELİ,1,300\.0,40\.0,12\.0/);
});

test('park report preview assigns content, download and modal using supplied DOM ports',()=>{
 const w=app(),title={},body={},download={},modal={classList:{value:'',add(value){this.value=value;}}};let saved;
 w.DG_EXPORT_PREVIEW_UI={open:element=>{assert.equal(element,modal);element.classList.add('on');}};
 w.DG_PARK_REPORT_PREVIEW_UI.show({title:'📄 Park',body:'<table/>',csv:'data',fileName:'park.csv',elements:{title,body,download,modal},download:(...args)=>{saved=args;}});
 assert.equal(title.textContent,'📄 Park');assert.equal(body.innerHTML,'<table/>');download.onclick();assert.deepEqual(saved,['data','park.csv']);assert.equal(modal.classList.value,'on');
});
