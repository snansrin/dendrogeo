import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/application/admin/read-photo-storage-usage.js',
 'src/ui/admin-storage-usage.js',
 'src/application/admin/clean-orphan-photos.js',
 'src/application/admin/re-geocode-measurements.js',
 'src/domain/admin/measurement-geojson.js'
];
function app(){
 const window={},context=vm.createContext({window});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 return window;
}

test('storage usage sums the same folder listing sizes and UI preserves quota thresholds',async()=>{
 const window=app(),calls=[];
 const storage={from(bucket){assert.equal(bucket,'dendro-photos');return{list(path,options){calls.push([path,options.limit]);return Promise.resolve({data:path===''?[{name:'u1'}]:[{metadata:{size:1048576}},{metadata:{size:524288}}]});}};}};
 const usage=await window.DG_READ_PHOTO_STORAGE_USAGE.read(storage);
 assert.deepEqual(JSON.parse(JSON.stringify(usage)),{bytes:1572864,count:2});
 assert.deepEqual(calls,[['',100],['u1',1000]]);
 const bar={style:{}},info={};
 window.DG_ADMIN_STORAGE_USAGE_UI.render(bar,info,{...usage,quota:2,format:(message,values)=>`${values.n}|${values.mb}|${values.q}`});
 assert.equal(bar.style.width,'75%');assert.equal(bar.style.background,'var(--amber)');assert.equal(info.textContent,'2|1.5|2');
});

test('orphan cleanup preserves measurement URLs and only removes unmatched public objects',async()=>{
 const window=app(),removed=[];
 const storage={from(){return{
  list(path){return Promise.resolve({data:path===''?[{name:'u1'}]:[{name:'keep.jpg'},{name:'old.jpg'}]});},
  getPublicUrl(path){return{data:{publicUrl:`https://cdn/${path}`}};},
  remove(paths){removed.push(paths);return Promise.resolve({error:null});}
 };}};
 const count=await window.DG_CLEAN_ORPHAN_PHOTOS.clean({storage,photoUrls:[{photo_url:'https://cdn/u1/keep.jpg'}]});
 assert.equal(count,1);assert.deepEqual(JSON.parse(JSON.stringify(removed)),[['u1/old.jpg']]);
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

test('GeoJSON retains point coordinates, property names and one-decimal DBH',()=>{
 const window=app(),result=window.DG_ADMIN_MEASUREMENT_GEOJSON.build([{point_id:4,lon:32.1,lat:39.9,species:'Çam',dbh_cm:12.345,height_m:8,carbon_kg:2,status:'Onaylı',photo_url:null}],{Çam:'Pinus'});
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[32.1,39.9]},properties:{point:4,species:'Çam',latin:'Pinus',dbh:12.3,height:8,carbon:2,status:'Onaylı',photo:''}}]});
});
