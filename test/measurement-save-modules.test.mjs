import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/application/trees/run-measurement-save.js',
  'src/ui/set-measurement-save-button.js',
  'src/application/trees/validate-measurement-save-form.js',
  'src/application/trees/resolve-measurement-save-gates.js',
  'src/domain/trees/build-measurement-record.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('save runner prevents overlap and restores busy state after success or error',async()=>{
  const{window}=setup(),events=[];let busy=false,release;
  const runner=window.DG_RUN_MEASUREMENT_SAVE.run,ports={isBusy:()=>busy,setBusy:value=>{busy=value;events.push(['busy',value]);},save:()=>{events.push('save');return new Promise(resolve=>{release=resolve;});},failed:error=>events.push(['failed',error.message])};
  const pending=runner(ports);await runner(ports);assert.deepEqual(events,[['busy',true],'save']);release('ok');assert.equal(await pending,'ok');assert.deepEqual(events,[['busy',true],'save',['busy',false]]);
  await runner({...ports,save:async()=>{throw Error('failed');}});assert.deepEqual(events.slice(-3),[['busy',true],['failed','failed'],['busy',false]]);
});

test('save button retains waiting copy, edit-aware label and park-gate restoration',()=>{
  const{window}=setup(),events=[],button={innerHTML:'Save',textContent:'',disabled:false,dataset:{},style:{}};
  const set=window.DG_SET_MEASUREMENT_SAVE_BUTTON.setBusy;
  set(true,{button,editing:false,parkGate:()=>events.push('gate')});assert.equal(button.disabled,true);assert.equal(button.innerHTML,'⏳ Hesaplanıyor ve kaydediliyor…');assert.equal(button.style.cursor,'wait');
  set(false,{button,editing:true,parkGate:()=>events.push('gate')});assert.equal(button.disabled,false);assert.equal(button.textContent,'💾 Kaydı Güncelle');assert.deepEqual(events,['gate']);
});

test('form validator clears aria flags and returns the established field/message on failure',()=>{
  const{window}=setup(),cleared=[];
  const invalid=window.DG_VALIDATE_MEASUREMENT_SAVE_FORM.validate({form:{projectId:1,pointId:0,measurementNo:1,group:'YAPRAKLI',species:'OAK',circumferenceCm:0,heightM:4},element:id=>({setAttribute:(name,value)=>cleared.push([id,name,value])}),validator:{validateNewMeasurement:()=>({valid:false,reason:'point'})},errors:{point:['mPoint','Nokta gerekli']},translate:value=>'tr:'+value});
  assert.equal(JSON.stringify(invalid),JSON.stringify({valid:false,focusId:'mPoint',message:'tr:Nokta gerekli',reason:'point'}));assert.equal(cleared.length,7);assert.ok(cleared.every(row=>row[1]==='aria-invalid'&&row[2]==='false'));
  const valid=window.DG_VALIDATE_MEASUREMENT_SAVE_FORM.validate({form:{projectId:1},element:()=>({setAttribute(){}}),validator:{validateNewMeasurement:()=>({valid:true})},errors:{},translate:String});assert.equal(valid.valid,true);assert.deepEqual(JSON.parse(JSON.stringify(valid.form)),{projectId:1});
});

test('save gates retain park, GPS and photo priority while allowing edits without GPS',()=>{
  const{window}=setup(),resolve=window.DG_RESOLVE_MEASUREMENT_SAVE_GATES.resolve,projects=[{id:1,park_id:5}];
  assert.equal(resolve({projectId:2,projects,parkSchemaOk:true,gps:null,photoValid:false}).reason,'park-required');
  assert.equal(resolve({projectId:1,projects,parkSchemaOk:true,gps:null,photoValid:false}).reason,'gps-required');
  assert.equal(resolve({projectId:1,projects,parkSchemaOk:true,gps:{},photoValid:false}).reason,'photo-invalid');
  assert.equal(resolve({projectId:1,editId:9,projects,parkSchemaOk:true,gps:null,photoValid:true}).allowed,true);
  assert.equal(resolve({projectId:1,projects,parkSchemaOk:false,gps:{},photoValid:true}).allowed,true);
});

test('measurement record builder preserves exact columns and optional park schema behavior',()=>{
  const{window}=setup(),build=window.DG_BUILD_MEASUREMENT_RECORD.build,input={owner:'u',projectId:3,pointId:8,measurementNo:2,group:'YAPRAKLI',species:'IHLAMUR',circumferenceCm:40,dbhCm:40/Math.PI,heightM:5,volumeM3:.2,carbonKg:12,parkSchemaOk:true,parkId:7};
  assert.equal(JSON.stringify(build(input)),JSON.stringify({owner:'u',project_id:3,point_id:8,measurement_no:2,grp:'YAPRAKLI',species:'IHLAMUR',girth_cm:40,dbh_cm:40/Math.PI,height_m:5,volume_m3:.2,carbon_kg:12,slope_deg:0,shared:true,status:'Beklemede',park_id:7}));
  const old=build({...input,parkSchemaOk:false});assert.equal(Object.hasOwn(old,'park_id'),false);
});

test('five save modules are loaded before measure.js, precached and delegated',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js'),source=read('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  for(const token of ['DG_RUN_MEASUREMENT_SAVE','DG_SET_MEASUREMENT_SAVE_BUTTON','DG_VALIDATE_MEASUREMENT_SAVE_FORM','DG_RESOLVE_MEASUREMENT_SAVE_GATES','DG_BUILD_MEASUREMENT_RECORD'])assert.ok(source.includes(token),token);
});
