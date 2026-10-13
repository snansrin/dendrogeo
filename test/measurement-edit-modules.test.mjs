import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/adapters/trees/fetch-measurement-for-edit.js',
  'src/domain/trees/build-measurement-edit-form.js',
  'src/ui/render-measurement-edit-form.js',
  'src/application/trees/edit-measurement-record.js',
  'src/application/trees/cancel-measurement-edit.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('edit adapter preserves the primary-key Supabase read contract',async()=>{
  const{window}=setup(),calls=[];
  const client={from:table=>{calls.push(['from',table]);return{select:columns=>{calls.push(['select',columns]);return{eq:(field,id)=>{calls.push(['eq',field,id]);return{single:async()=>({data:{id:5},error:null})};}};}};}};
  assert.deepEqual(JSON.parse(JSON.stringify(await window.DG_FETCH_MEASUREMENT_FOR_EDIT.fetch({client,id:5}))),{id:5});
  assert.equal(JSON.stringify(calls),JSON.stringify([['from','measurements'],['select','*'],['eq','id',5]]));
});

test('domain mapper preserves current and legacy measurement form values',()=>{
  const{window}=setup(),build=window.DG_BUILD_MEASUREMENT_EDIT_FORM.build;
  assert.equal(JSON.stringify(build({project_id:3,point_id:7,measurement_no:2,grp:'YAPRAKLI',species:'IHLAMUR',girth_cm:40,dbh_cm:12,height_m:4.5},()=>99)),JSON.stringify({projectId:3,pointId:7,measurementNo:2,group:'YAPRAKLI',species:'IHLAMUR',circumference:40,height:4.5}));
  assert.equal(JSON.stringify(build({project_id:3,point_id:7,grp:null,species:'SÖĞÜT',girth_cm:null,dbh_cm:20,height_m:8},diameter=>diameter*Math.PI)),JSON.stringify({projectId:3,pointId:7,measurementNo:1,group:'',species:'SÖĞÜT',circumference:20*Math.PI,height:8}));
});

test('edit UI fills project and species fields in the established sequence',()=>{
  const{window}=setup(),events=[],elements=Object.fromEntries(['mProject','mPoint','mNo','mGroup','mSpecies','mDbh','mHeight','editBanner','saveBtn'].map(id=>[id,{value:'',textContent:'',style:{}}]));
  window.DG_RENDER_MEASUREMENT_EDIT_FORM.render({projectId:2,pointId:9,measurementNo:1,group:'İBRELİ',species:'KARAÇAM',circumference:35,height:10},{element:id=>elements[id],fillSpecies:()=>events.push('species'),showLatin:()=>events.push('latin')});
  assert.deepEqual(events,['species','latin']);assert.equal(elements.mProject.value,2);assert.equal(elements.mPoint.value,9);assert.equal(elements.mGroup.value,'İBRELİ');assert.equal(elements.mSpecies.value,'KARAÇAM');assert.equal(elements.mDbh.value,35);assert.equal(elements.mHeight.value,10);assert.equal(elements.editBanner.style.display,'block');assert.equal(elements.saveBtn.textContent,'💾 Kaydı Güncelle');
});

test('edit use case keeps fetch, clear, state, render, recalc, navigation order and skips missing rows',async()=>{
  const{window}=setup(),events=[],ports={fetch:async id=>{events.push(['fetch',id]);return{id};},clearPhoto:()=>events.push('clear'),setEditing:id=>events.push(['editing',id]),build:record=>({id:record.id}),render:form=>events.push(['render',form]),liveCalc:()=>events.push('calc'),navigate:page=>events.push(['navigate',page]),projectChanged:()=>events.push('project')};
  assert.deepEqual(JSON.parse(JSON.stringify(await window.DG_EDIT_MEASUREMENT_RECORD.edit(5,ports))),{id:5});
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['fetch','clear','editing','render','calc','navigate','project']);
  events.length=0;await window.DG_EDIT_MEASUREMENT_RECORD.edit(8,{...ports,fetch:async id=>{events.push(['fetch',id]);return null;}});assert.deepEqual(events,[['fetch',8]]);
});

test('cancel edit resets edit and manual-point state before restoring the park gate',()=>{
  const{window}=setup(),events=[],elements={editBanner:{style:{}},saveBtn:{textContent:''}};
  window.DG_CANCEL_MEASUREMENT_EDIT.cancel({setEditing:id=>events.push(['editing',id]),setManualPoint:value=>events.push(['manual',value]),element:id=>elements[id],parkGate:()=>events.push('gate')});
  assert.deepEqual(events,[['editing',null],['manual',false],'gate']);assert.equal(elements.editBanner.style.display,'none');assert.equal(elements.saveBtn.textContent,'💾 Hesapla ve Kaydet');
});

test('five edit modules load before measure.js, are precached and delegated from the service',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js'),source=read('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  for(const token of ['DG_FETCH_MEASUREMENT_FOR_EDIT','DG_BUILD_MEASUREMENT_EDIT_FORM','DG_RENDER_MEASUREMENT_EDIT_FORM','DG_EDIT_MEASUREMENT_RECORD','DG_CANCEL_MEASUREMENT_EDIT'])assert.ok(source.includes(token),token);
});
