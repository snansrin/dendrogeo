import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/adapters/admin/admin-persistence-store.js',
 'src/application/admin/read-photo-storage-usage.js',
 'src/ui/admin-storage-usage.js',
 'src/application/admin/clean-orphan-photos.js',
 'src/application/admin/re-geocode-measurements.js',
 'src/adapters/admin/re-geocode-store.js',
 'src/ui/confirm-admin-re-geocode.js',
 'src/ui/admin-re-geocode-feedback.js',
 'src/domain/admin/measurement-geojson.js'
];
function app(){
 const window={},context=vm.createContext({window});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 return window;
}

test('storage usage sums folder sizes and UI uses decimal storage units',async()=>{
 const window=app(),calls=[];
 const storage={from(bucket){assert.equal(bucket,'dendro-photos');return{list(path,options){calls.push([path,options.limit]);return Promise.resolve({data:path===''?[{name:'u1'}]:[{metadata:{size:1048576}},{metadata:{size:524288}}]});}};}};
 const ports=window.DG_ADMIN_PERSISTENCE_STORE.create(()=>({storage}));
 const usage=await window.DG_READ_PHOTO_STORAGE_USAGE.read(ports);
 assert.deepEqual(JSON.parse(JSON.stringify(usage)),{bytes:1572864,count:2});
 assert.deepEqual(calls,[['',100],['u1',1000]]);
 const bar={style:{}},info={};
 window.DG_ADMIN_STORAGE_USAGE_UI.render(bar,info,{bytes:1500000,count:2,quotaBytes:2000000,format:(message,values)=>`${values.n}|${values.mb}|${values.q}`});
 assert.equal(bar.style.width,'75%');assert.equal(bar.style.background,'var(--amber)');assert.equal(info.textContent,'2|1.5|2');
});

test('photo capacity is 1 GB and warnings begin at 70, 85 and 95 percent',()=>{
 const window=app(),bar={style:{}},warning={style:{}},info={ownerDocument:{getElementById:id=>id==='storeWarning'?warning:null}};
 const format=(text,values)=>text.replace(/\{(\w+)\}/g,(_,key)=>values[key]);
 for(const [bytes,color,hidden,phrase] of [[699999999,'green',true,null],[700000000,'amber',false,'Kalan alanı takip'],[850000000,'red',false,'kapasitesini artırmayı'],[950000000,'red',false,'çok az alan'],[1100000000,'red',false,'çok az alan']]){
  window.DG_ADMIN_STORAGE_USAGE_UI.render(bar,info,{bytes,count:63,format});
  assert.equal(bar.style.background,`var(--${color})`);assert.equal(warning.hidden,hidden);
  assert.ok(info.textContent.endsWith('/ 1000 MB'));
  if(phrase)assert.ok(warning.textContent.includes(phrase));
  assert.ok(parseFloat(bar.style.width)<=100);
 }
 window.DG_ADMIN_STORAGE_USAGE_UI.unavailable(info,'Unavailable');assert.equal(warning.hidden,true);
});

test('storage count reads beyond 100 folders and 1000 photos, including root files',async()=>{
 const window=app(),calls=[];
 const files={ '':Array.from({length:101},(_,i)=>({name:'u'+i})).concat({name:'root.jpg',id:'root',metadata:{size:3}}),u0:Array.from({length:1001},(_,i)=>({name:i+'.jpg',id:String(i),metadata:{size:2}})) };
 const result=await window.DG_READ_PHOTO_STORAGE_USAGE.read({listPhotoFiles:async(bucket,path,limit,offset)=>{calls.push([path,offset]);return(files[path]||[]).slice(offset,offset+limit);}});
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{bytes:2005,count:1002});
 assert.ok(calls.some(([path,offset])=>path===''&&offset===100));
 assert.ok(calls.some(([path,offset])=>path==='u0'&&offset===1000));
});

test('storage count fails instead of displaying incomplete or malformed usage',async()=>{
 const window=app();
 await assert.rejects(window.DG_READ_PHOTO_STORAGE_USAGE.read({listPhotoFiles:async()=>[{id:'bad',metadata:{size:'invalid'}}]}),/boyutu/);
 await assert.rejects(window.DG_READ_PHOTO_STORAGE_USAGE.read({listPhotoFiles:async()=>{throw Error('permission denied');}}),/permission denied/);
});

test('orphan cleanup preserves measurement URLs and only removes unmatched public objects',async()=>{
 const window=app(),removed=[];
 const storage={from(){return{
  list(path){return Promise.resolve({data:path===''?[{name:'u1'}]:[{name:'keep.jpg'},{name:'old.jpg'}]});},
  getPublicUrl(path){return{data:{publicUrl:`https://cdn/${path}`}};},
  remove(paths){removed.push(paths);return Promise.resolve({error:null});}
 };}};
 const ports=window.DG_ADMIN_PERSISTENCE_STORE.create(()=>({storage,from(table){assert.equal(table,'measurements');return{select:()=>Promise.resolve({data:[{photo_url:'https://cdn/u1/keep.jpg'}],error:null})};}}));
 const count=await window.DG_CLEAN_ORPHAN_PHOTOS.clean({ports});
 assert.equal(count,1);assert.deepEqual(JSON.parse(JSON.stringify(removed)),[['u1/old.jpg']]);
});

test('orphan cleanup aborts before Storage access when measurement photo references cannot be verified',async()=>{
 const window=app(),events=[];
 await assert.rejects(window.DG_CLEAN_ORPHAN_PHOTOS.clean({ports:{
  loadMeasurementPhotoUrls:async()=>{events.push('query');throw Error('permission denied');},
  listPhotoFiles:async()=>{events.push('list');return[];},removePhotoFiles:async()=>events.push('remove')
 }}),/permission denied/);
 assert.deepEqual(events,['query']);
});

test('re-geocoding skips invalid coordinates, updates changed places and paces valid requests',async()=>{
 const window=app(),reverse=[],updates=[],waits=[];
 const rows=[{id:1,lat:10,lon:20,city:'Old',country:'TR'},{id:2,lat:'bad',lon:1},{id:3,lat:11,lon:21,city:'Same',country:'TR'}];
 const count=await window.DG_RE_GEOCODE_MEASUREMENTS.run(rows,{
  isValidCoordinate:(lat,lon)=>Number.isFinite(+lat)&&Number.isFinite(+lon),
  reverse:async(lat,lon)=>{reverse.push([lat,lon]);return lat===10?{city:'New',country:'TR'}:{city:'Same',country:'TR'};},
  update:async(id,fields)=>updates.push([id,fields]),wait:async ms=>waits.push(ms)
 });
 assert.equal(count,1);assert.deepEqual(reverse,[[10,20],[11,21]]);assert.deepEqual(JSON.parse(JSON.stringify(updates)),[[1,{city:'New',country:'TR'}]]);assert.deepEqual(waits,[1100,1100]);
});

test('re-geocoding adapter preserves the measurement projection and id-scoped update',async()=>{
 const window=app(),calls=[];
 const client={from(table){calls.push(['from',table]);return{
  select(fields){calls.push(['select',fields]);return Promise.resolve({data:[{id:7,lat:1,lon:2,city:'A',country:'B'}]});},
  update(fields){calls.push(['update',fields]);return{eq:(key,value)=>{calls.push(['eq',key,value]);return Promise.resolve({error:null});}};}
 };}};
 const store=window.DG_ADMIN_RE_GEOCODE_STORE.create(()=>client);
 assert.deepEqual(JSON.parse(JSON.stringify(await store.loadMeasurements())),[{id:7,lat:1,lon:2,city:'A',country:'B'}]);
 await store.updatePlace(7,{city:'C',country:'D'});
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  ['from','measurements'],['select','id,lat,lon,city,country'],
  ['from','measurements'],['update',{city:'C',country:'D'}],['eq','id',7]
 ]);
});

test('re-geocoding use case gates access and confirmation before reads, then reports and refreshes in order',async()=>{
 const window=app(),events=[];
 const ports={
  authorized:()=>false,confirm:()=>{events.push('confirm');return true;},loadRows:async()=>{events.push('load');return[];},
  isValidCoordinate:()=>true,reverse:async()=>null,update:async()=>{},wait:async()=>{},
  onDenied:()=>events.push('denied'),onComplete:count=>events.push(['complete',count]),refresh:()=>events.push('refresh')
 };
 assert.equal(await window.DG_RE_GEOCODE_MEASUREMENTS.execute(ports),0);
 assert.deepEqual(events,['denied']);
 events.length=0;
 assert.equal(await window.DG_RE_GEOCODE_MEASUREMENTS.execute({...ports,authorized:()=>true,confirm:()=>false}),0);
 assert.deepEqual(events,[]);
 events.length=0;
 assert.equal(await window.DG_RE_GEOCODE_MEASUREMENTS.execute({...ports,authorized:()=>true,confirm:()=>{events.push('confirm');return true;}}),0);
 assert.deepEqual(events,['confirm','load',['complete',0],'refresh']);
});

test('re-geocoding confirmation and feedback keep their current Turkish copy',()=>{
 const window=app(),messages=[];
 assert.equal(window.DG_CONFIRM_ADMIN_RE_GEOCODE.ask(message=>{messages.push(message);return false;},value=>value),false);
 window.DG_ADMIN_RE_GEOCODE_FEEDBACK.denied((...args)=>messages.push(args));
 window.DG_ADMIN_RE_GEOCODE_FEEDBACK.completed((...args)=>messages.push(args),(text,values)=>text.replace('{n}',values.n),3);
 assert.deepEqual(JSON.parse(JSON.stringify(messages)),[
  'Tüm kayıtların şehir/ülke bilgisi GPS koordinatından yeniden algılansın mı? (Nominatim limiti ~1 istek/sn)',
  ['Yetki yok.','err'],['✓ 3 kaydın şehri güncellendi','ok','🌍']
 ]);
});

test('re-geocoding modules load before admin facade and remain in the offline precache',()=>{
 const head=readFileSync(new URL('../partials/head.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const service=head.indexOf('src/services/admin.js');
 for(const path of ['src/application/admin/re-geocode-measurements.js','src/adapters/admin/re-geocode-store.js','src/ui/confirm-admin-re-geocode.js','src/ui/admin-re-geocode-feedback.js']){
  assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,path+' must load before the facade');
  assert.ok(sw.includes('/'+path),path+' must be precached');
 }
});

test('admin re-geocoding facade wires the use case, adapter and presentation ports',async()=>{
 const window=app(),calls=[];
 const client={from(table){assert.equal(table,'measurements');return{
  select:()=>Promise.resolve({data:[{id:1,lat:10,lon:20,city:'Old',country:'TR'}]}),
  update:fields=>({eq:(key,id)=>{calls.push(['update',key,id,fields]);return Promise.resolve({error:null});}})
 };}};
 window.DG_ADMIN_RE_GEOCODE_STORE=window.DG_ADMIN_RE_GEOCODE_STORE;
 const context=vm.createContext({window,PROFILE:{role:'owner'},sb:client,confirm:message=>{calls.push(['confirm',message]);return true;},dgCf:value=>value,
  toast:(...args)=>calls.push(['toast',...args]),_tadf:(text,values)=>text.replace('{n}',values.n),reverseGeocode:async()=>({city:'New',country:'TR'}),
  setTimeout:callback=>{callback();return 1;},loadWorld:()=>calls.push(['world']),loadAdmin:()=>calls.push(['admin'])});
 const service=readFileSync(new URL('../src/services/admin.js',import.meta.url),'utf8');
 const start=service.indexOf('async function reGeocodeAll(){'),end=service.indexOf('\nasync function delMeas',start);
 vm.runInContext(service.slice(start,end),context,{filename:'src/services/admin.js'});
 await vm.runInContext('reGeocodeAll()',context);
 assert.deepEqual(calls.map(entry=>entry[0]),['confirm','update','toast','world','admin']);
 assert.equal(calls[1][1],'id');assert.equal(calls[1][2],1);
});

test('GeoJSON retains point coordinates, property names and one-decimal DBH',()=>{
 const window=app(),result=window.DG_ADMIN_MEASUREMENT_GEOJSON.build([{point_id:4,lon:32.1,lat:39.9,species:'Çam',dbh_cm:12.345,height_m:8,carbon_kg:2,status:'Onaylı',photo_url:null}],{Çam:'Pinus'});
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[32.1,39.9]},properties:{point:4,species:'Çam',latin:'Pinus',dbh:12.3,height:8,carbon:2,status:'Onaylı',photo:''}}]});
});
