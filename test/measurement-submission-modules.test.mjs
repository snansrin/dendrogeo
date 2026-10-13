import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/application/trees/validate-measurement-submission.js',
  'src/application/trees/prepare-measurement-submission.js',
  'src/application/trees/verify-measurement-submission-location.js',
  'src/application/trees/persist-measurement-submission.js',
  'src/application/trees/submit-measurement.js'
];
function setup(){const context=vm.createContext({window:{}});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return context;}

test('measurement submission preserves phase order and only uploads after location verification',async()=>{
  const context=setup(),events=[],project={id:4,park_id:9},form={projectId:4,pointId:3,measurementNo:1,group:'İBRELİ',species:'KARAÇAM',circumferenceCm:30,heightM:8};
  context.form=form;context.ports={
    validation:{validateForm:value=>{events.push('form');assert.equal(value,form);return{valid:true};},resolveGates:()=>{events.push('gates');return{reason:null,project};}},
    prepare:{rememberProject:id=>events.push(['remember',id]),preparePhoto:async()=>{events.push('photo');return{blob:{image:true},fileName:'P003_M1.JPG'};},calculate:()=>{events.push('calculate');return{valid:true,total_carbon:12.5,dbh_cm:9.5,vol:.02};},buildRecord:()=>{events.push('record');return{client_id:null};},createClientId:()=>{events.push('client-id');return'c1';},gps:()=>({latitude:40,longitude:32}),reverseGeocode:async()=>{events.push('geocode');return null;},buildLocationFields:()=>{events.push('location-fields');return{lat:40,lon:32};}},
    location:{loadPark:async()=>{events.push('load-park');return{id:9,name:'Park'};},verifyAtPark:async()=>{events.push('verify');return{ok:true,verified:true,fix:{acc:5},reason:'inside'};},stamp:()=>events.push('stamp')},
    persistence:{isOnline:()=>true,uploadPhoto:async()=>{events.push('upload');return{publicUrl:'photo'};},persistRecord:async(record,id)=>{events.push(['persist',record.photo_url,id]);return{error:null};},editId:()=>null},
    stopForValidation:result=>events.push(['halt',result.reason]),locationRejected:()=>events.push('rejected'),writeFailed:()=>events.push('write-failed'),
    complete:result=>{events.push(['complete',result.mode,result.draft.record.client_id]);return'complete';}
  };
  assert.equal(await vm.runInContext('window.DG_SUBMIT_MEASUREMENT.run({form,editId:null},ports)',context),'complete');
  assert.deepEqual(events.map(item=>Array.isArray(item)?item[0]:item),['form','gates','remember','photo','calculate','record','client-id','geocode','location-fields','load-park','verify','stamp','upload','persist','complete']);
  assert.ok(events.indexOf('verify')<events.indexOf('upload'));
});

test('invalid form stops before photo, location and persistence phases',async()=>{
  const context=setup(),events=[],form={};context.form=form;context.ports={validation:{validateForm:()=>({valid:false,focusId:'mPoint',message:'invalid'}),resolveGates:()=>assert.fail('gate should not run')},prepare:{preparePhoto:()=>assert.fail('photo should not run')},location:{loadPark:()=>assert.fail('location should not run')},persistence:{persistRecord:()=>assert.fail('write should not run')},stopForValidation:result=>events.push(result.reason),locationRejected:()=>{},writeFailed:()=>{},complete:()=>assert.fail('must stop')};
  await vm.runInContext('window.DG_SUBMIT_MEASUREMENT.run({form,editId:null},ports)',context);assert.deepEqual(events,['form']);
});

test('five save phases load before the locked measurement service and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),source=read('src/services/measure.js'),service=head.indexOf('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.ok(source.includes('DG_SUBMIT_MEASUREMENT.run'));
});
