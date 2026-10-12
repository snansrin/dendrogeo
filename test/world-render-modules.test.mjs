import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/ui/park-comparison-row.js','src/ui/park-comparison-pending.js',
 'src/ui/park-report-options.js','src/ui/park-comparison-error.js',
 'src/application/world/fit-measurement-rows.js'
];
function app(){const window={},ctx=vm.createContext({window});for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx,{filename:file});return window;}
const escape=value=>String(value??'').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

test('park comparison row keeps ranking, translated counts, carbon and mobile classes',()=>{
 const w=app(),html=w.DG_PARK_COMPARISON_ROW.render({park_name:'<Göksu>',city:'Ankara',records:12,carbon_kg:1250,area_m2:10000,contributors:3,projects:2,species_n:4,avg_dbh:20,avg_height:8},0,2500,{escape,translate:value=>value,formatHa:()=> '1 ha'});
 assert.match(html,/class="dg-cmp-row lead"/);assert.match(html,/&lt;Göksu&gt;/);assert.match(html,/1\.25 t/);assert.match(html,/1\.25 t\/ha/);assert.match(html,/width:50%/);
});

test('pending park panel reveals scan only to admins and report options escape values',()=>{
 const w=app(),pending=[{park_name:'Old <Park>',city:'Ankara',records:2,carbon_kg:1000}];
 const admin=w.DG_PARK_COMPARISON_PENDING.render(pending,{isAdmin:true,escape});
 const user=w.DG_PARK_COMPARISON_PENDING.render(pending,{isAdmin:false,escape});
 assert.match(admin,/startParkScan/);assert.doesNotMatch(user,/startParkScan/);assert.match(user,/yalnız yönetici/);
 const element={};w.DG_PARK_REPORT_OPTIONS_UI.render(element,[{park_id:7,park_name:'Göksu'}],pending,escape);
 assert.match(element.innerHTML,/value="7"/);assert.match(element.innerHTML,/proj:Old &lt;Park&gt;/);assert.doesNotMatch(element.innerHTML,/Old <Park>/);
});

test('comparison errors escape database details and never need schema-state changes',()=>{
 const html=app().DG_PARK_COMPARISON_ERROR_UI.render({code:'<42501>',message:'<denied>',isAdmin:false,escape});
 assert.match(html,/&lt;42501&gt;/);assert.match(html,/&lt;denied&gt;/);assert.match(html,/loadParkCompare\(\)/);
});

test('map fitting filters invalid coordinates and preserves the 0.25 bounds pad',()=>{
 const fit=app().DG_FIT_MEASUREMENT_ROWS,seen=[],toasts=[];
 const map={fitBounds(bounds,options){seen.push([bounds,options]);}};
 fit.fit(map,[{lat:0,lon:10},{lat:39,lon:32}], 'Ankara','🌍',{isValidCoordinate:(lat,lon)=>Number.isFinite(+lat)&&Number.isFinite(+lon)&&(+lat!==0&&+lon!==0),bounds:points=>({points,pad(amount){this.amount=amount;return this;}}),toast:(...args)=>toasts.push(args),translate:value=>value});
 assert.equal(seen[0][0].points.length,1);assert.equal(seen[0][0].amount,0.25);assert.deepEqual(JSON.parse(JSON.stringify(seen[0][1])),{maxZoom:12});assert.equal(toasts[0][0],'Ankara haritada');
 fit.fit(map,[{lat:null,lon:null}], 'Boş','🌍',{isValidCoordinate:()=>false,bounds:()=>null,toast:(...args)=>toasts.push(args),translate:value=>value});
 assert.equal(toasts[1][0],'Boş için onaylı nokta yok');
});
