import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/application/trees/measurement-photo-check-state.js',
  'src/adapters/trees/read-measurement-photo-pixels.js',
  'src/ui/measurement-photo-check.js',
  'src/ui/measurement-photo-file.js',
  'src/application/trees/check-measurement-photo.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('photo-check generations reject stale results after a new check or clear',()=>{
  const{window}=setup(),updates=[],state=window.DG_MEASUREMENT_PHOTO_CHECK_STATE.create(value=>updates.push(value));
  const first=state.begin(),second=state.begin();assert.equal(state.isCurrent(first),false);assert.equal(state.isCurrent(second),true);
  const cleared=state.invalidate();assert.equal(state.isCurrent(second),false);assert.equal(state.isCurrent(cleared),true);assert.deepEqual(updates,[1,2,3]);
});

test('pixel adapter draws the fixed square, revokes its URL and returns sampled pixels',()=>{
  const{window}=setup(),events=[],pixels=new Uint8ClampedArray([1,2,3,4]);
  const result=window.DG_READ_MEASUREMENT_PHOTO_PIXELS_ADAPTER.read({image:{id:'photo'},url:'blob:photo'},120,{createCanvas:()=>({set width(value){events.push(['width',value]);},set height(value){events.push(['height',value]);},getContext:(kind,options)=>({drawImage:(...args)=>events.push(['draw',...args]),getImageData:(...args)=>{events.push(['pixels',...args]);return{data:pixels};}})}),revokeObjectURL:url=>events.push(['revoke',url])});
  assert.equal(result,pixels);assert.deepEqual(events.map(event=>event[0]),['width','height','draw','revoke','pixels']);assert.equal(events[2][1].id,'photo');assert.deepEqual(events[4].slice(1),[0,0,120,120]);
});

test('photo file UI selects a name and clears file, feedback and remove control',()=>{
  const{window}=setup(),elements={mPhoto:{value:'selected'},mPhotoName:{textContent:'tree.jpg'},photoCheck:{style:{display:'block'}},mPhotoRemove:{style:{display:'inline-flex'}}},element=id=>elements[id];
  window.DG_MEASUREMENT_PHOTO_FILE_UI.select({name:'new-tree.jpg'},element);assert.equal(elements.mPhotoName.textContent,'new-tree.jpg');assert.equal(elements.mPhotoRemove.style.display,'inline-flex');
  window.DG_MEASUREMENT_PHOTO_FILE_UI.clear(element);assert.equal(elements.mPhoto.value,'');assert.equal(elements.mPhotoName.textContent,'');assert.equal(elements.photoCheck.style.display,'none');assert.equal(elements.mPhotoRemove.style.display,'none');
});

test('photo check gates valid photos, rejects non-images and ignores a check after clear',async()=>{
  const{window}=setup(),state=window.DG_MEASUREMENT_PHOTO_CHECK_STATE.create(),box={style:{},className:'',innerHTML:''},events=[];
  let imageResolve;
  const check=window.DG_CHECK_MEASUREMENT_PHOTO.create({state,element:()=>box,setPhotoOk:value=>events.push(['ok',value]),selectFile:file=>events.push(['file',file?.name||'']),showInvalidType:()=>events.push('invalid'),showPending:()=>events.push('pending'),loadImage:file=>file.name==='slow.jpg'?new Promise(resolve=>{imageResolve=resolve;}):Promise.resolve({image:{},url:'blob:good'}),readPixels:()=>new Uint8ClampedArray(4),scan:()=>({lum:100}),gate:()=>true,label:()=> 'gövde kanıtı',showPassed:(target,metrics,label)=>events.push(['passed',label]),showFailed:()=>events.push('failed'),showUnreadable:()=>events.push('unreadable'),revokeObjectURL:url=>events.push(['revoke',url])});
  await check({target:{files:[{name:'tree.jpg',type:'image/jpeg'}]}});assert.deepEqual(events.slice(0,4).map(value=>Array.isArray(value)?value[0]:value),['ok','file','pending','ok']);assert.ok(events.some(event=>Array.isArray(event)&&event[0]==='passed'));
  events.length=0;await check({target:{files:[{name:'notes.txt',type:'text/plain'}]}});assert.equal(events.at(-1),'invalid');assert.deepEqual(events.slice(0,2),[['ok',false],['file','notes.txt']]);
  const stale=check({target:{files:[{name:'slow.jpg',type:'image/jpeg'}]}});state.invalidate();imageResolve({image:{},url:'blob:stale'});await stale;assert.ok(events.some(event=>Array.isArray(event)&&event[0]==='revoke'&&event[1]==='blob:stale'));assert.equal(events.some(event=>Array.isArray(event)&&event[0]==='passed'),false);
});

test('photo lifecycle modules load before measure, are precached and service retains its legacy fallback',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/measure.js'),measure=head.indexOf('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<measure,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.ok(service.includes('DG_CHECK_MEASUREMENT_PHOTO_USE_CASE(e)'));assert.ok(service.includes('async function checkPhoto(e)'));assert.ok(service.includes('dgPhotoScan'));assert.ok(service.includes('dgPhotoGate'));
});
