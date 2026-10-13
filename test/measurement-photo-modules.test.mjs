import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/trees/build-measurement-photo-file-name.js',
  'src/ui/compress-measurement-photo.js',
  'src/application/trees/prepare-measurement-photo.js',
  'src/adapters/trees/upload-measurement-photo.js',
  'src/adapters/trees/remove-measurement-photo.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('photo filename retains the field point and measurement naming contract',()=>{
  const{window}=setup();assert.equal(window.DG_BUILD_MEASUREMENT_PHOTO_FILE_NAME.build({pointId:7,measurementNo:2}),'P007_M2.JPG');
});

test('photo compressor preserves aspect ratio, JPEG settings and object URL cleanup',async()=>{
  const{window}=setup(),events=[];let blob;
  const ports={loadImage:async()=>({i:{width:2400,height:1200},u:'blob:photo'}),URL:{revokeObjectURL:url=>events.push(['revoke',url])},document:{createElement:name=>{assert.equal(name,'canvas');const canvas={getContext:kind=>({drawImage:(...args)=>events.push(['draw',...args])}),toBlob:(callback,type,quality)=>{events.push(['blob',type,quality]);callback(blob={type,quality});}};return canvas;}}};
  const result=await window.DG_COMPRESS_MEASUREMENT_PHOTO.compress({name:'tree.jpg'},ports);
  assert.equal(result,blob);assert.deepEqual(events.map(event=>event[0]),['draw','blob','revoke']);assert.deepEqual(events[1].slice(1),['image/jpeg',.7]);assert.equal(events[0][4],1024);assert.equal(events[0][5],512);
});

test('photo preparation returns the same JPEG blob and canonical name for offline or online callers',async()=>{
  const{window}=setup(),blob={size:42},events=[];
  const empty=await window.DG_PREPARE_MEASUREMENT_PHOTO.prepare({file:null,pointId:1,measurementNo:1,compress:()=>assert.fail('empty file must skip compression'),buildFileName:()=>''});
  const photo=await window.DG_PREPARE_MEASUREMENT_PHOTO.prepare({file:{name:'tree.jpg'},pointId:29,measurementNo:3,compress:async file=>{events.push(file.name);return blob;},buildFileName:parts=>window.DG_BUILD_MEASUREMENT_PHOTO_FILE_NAME.build(parts)});
  assert.equal(empty,null);assert.equal(photo.blob,blob);assert.equal(photo.fileName,'P029_M3.JPG');assert.deepEqual(events,['tree.jpg']);
});

test('photo upload preserves storage bucket, owner path, JPEG type and public URL',async()=>{
  const{window}=setup(),calls=[],client={storage:{from:bucket=>{calls.push(['from',bucket]);return{upload:async(path,blob,options)=>{calls.push(['upload',path,blob,options]);return{error:null};},getPublicUrl:path=>{calls.push(['public',path]);return{data:{publicUrl:'https://storage.test/'+path}};}};}}};
  const blob={size:2},uploaded=await window.DG_UPLOAD_MEASUREMENT_PHOTO.upload({client,userId:'owner-1',blob,now:()=>123});
  assert.equal(JSON.stringify(calls),JSON.stringify([['from','dendro-photos'],['upload','owner-1/123.jpg',blob,{contentType:'image/jpeg'}],['from','dendro-photos'],['public','owner-1/123.jpg']]));assert.deepEqual(JSON.parse(JSON.stringify(uploaded)),{path:'owner-1/123.jpg',publicUrl:'https://storage.test/owner-1/123.jpg'});
  const failing={storage:{from:()=>({upload:async()=>({error:{message:'denied'}}),getPublicUrl:()=>assert.fail('must not expose URL')})}};
  await assert.rejects(window.DG_UPLOAD_MEASUREMENT_PHOTO.upload({client:failing,userId:'owner-1',blob,now:()=>123}),error=>error.message==='denied');
});

test('photo removal keeps raw and decoded legacy storage-path attempts',async()=>{
  const{window}=setup(),calls=[],client={storage:{from:bucket=>({remove:async paths=>{calls.push([bucket,paths]);}})}};
  await window.DG_REMOVE_MEASUREMENT_PHOTO.remove({client,url:'https://storage.test/dendro-photos/u/a%20b.jpg'});
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['dendro-photos',['u/a%20b.jpg']],['dendro-photos',['u/a b.jpg']]]);
  await window.DG_REMOVE_MEASUREMENT_PHOTO.remove({client,url:null});assert.equal(calls.length,2);
});

test('five photo modules precede measure.js, are precached and remain behind geofence ordering',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src/services/measure.js'),source=read('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.ok(source.indexOf('dgVerifyAtPark')<source.indexOf('DG_UPLOAD_MEASUREMENT_PHOTO.upload'));
  for(const token of ['DG_BUILD_MEASUREMENT_PHOTO_FILE_NAME','DG_COMPRESS_MEASUREMENT_PHOTO','DG_PREPARE_MEASUREMENT_PHOTO','DG_UPLOAD_MEASUREMENT_PHOTO','DG_REMOVE_MEASUREMENT_PHOTO'])assert.ok(source.includes(token),token);
});
