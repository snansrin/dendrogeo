import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(path,globals={}){
  const window={};const context=vm.createContext({window,...globals});
  vm.runInContext(read(path),context,{filename:path});
  return{window,context};
}

test('reverse geocoder keeps Turkish province and international locality rules',async()=>{
  const{window}=load('src/adapters/trees/reverse-geocode.js');
  const fetcher=async()=>({ok:true,json:async()=>({address:{country_code:'tr',state:'Ankara',city:'Çankaya',country:'Türkiye'}})});
  const turkish=await window.DG_MEASUREMENT_REVERSE_GEOCODE.resolve(fetcher,40,32);
  assert.equal(turkish.city,'Ankara');assert.equal(turkish.country,'Türkiye');
  const international=async()=>({ok:true,json:async()=>({address:{country_code:'fr',city:'Paris',state:'Île-de-France',country:'France'}})});
  const french=await window.DG_MEASUREMENT_REVERSE_GEOCODE.resolve(international,48,2);
  assert.equal(french.city,'Paris');assert.equal(french.country,'France');
});

test('photo image adapter revokes an unreadable image URL',async()=>{
  const revoked=[];const image={set src(value){this._src=value;}};
  const{window}=load('src/adapters/trees/load-measurement-photo.js',{URL:{createObjectURL:()=> 'blob:tree',revokeObjectURL:value=>revoked.push(value)},Image:function(){return image;}});
  const pending=window.DG_MEASUREMENT_PHOTO_IMAGE.load({});image.onerror();
  await assert.rejects(pending,/image/);assert.deepEqual(revoked,['blob:tree']);
});

test('photo evidence summary preserves thresholds and rounded percentages',()=>{
  const{window}=load('src/ui/measurement-photo-summary.js');
  const summary=window.DG_MEASUREMENT_PHOTO_SUMMARY.format({green:.054,purple:.049,warm:.06,woody:.05,blue:.25,struct:.025,dark:0},value=>'T:'+value);
  assert.equal(summary,'T:yeşil örtü %5 · T:sonbahar rengi %6 · T:gövde/dal %5 · T:kış kadrajı (dal silüeti)');
});

test('GPS button module restores the previous label and enabled styles',()=>{
  const button={innerHTML:'Konumu aç',dataset:{},style:{},disabled:false};
  const{window,context}=load('src/ui/measurement-gps-button.js');
  context.getElement=()=>button;
  const api=window.DG_MEASUREMENT_GPS_BUTTON;
  api.setBusy(true,context.getElement);
  assert.equal(button.disabled,true);assert.equal(button.innerHTML,'⏳ Konum alınıyor…');
  api.setBusy(false,context.getElement);
  assert.equal(button.disabled,false);assert.equal(button.innerHTML,'Konumu aç');assert.equal(button.style.opacity,'');
});

test('species selector sorts display labels and keeps canonical Turkish values',()=>{
  const elements={mGroup:{value:'YAPRAKLI'},mSpecies:{},latinName:{}};
  const{window,context}=load('src/ui/measurement-species-selector.js');
  context.getElement=id=>elements[id];
  window.DG_MEASUREMENT_SPECIES_SELECTOR.fill({getElement:context.getElement,speciesData:{YAPRAKLI:[{tr:'ZELKOVA',lat:'Zelkova'},{tr:'IHLAMUR',lat:'Tilia'}]},turkishLabels:{},translate:value=>'EN '+value});
  assert.match(elements.mSpecies.innerHTML,/value="IHLAMUR">EN IHLAMUR · Tilia.*value="ZELKOVA">EN ZELKOVA/);
  assert.equal(elements.mSpecies.disabled,false);
  elements.mSpecies.value='IHLAMUR';
  window.DG_MEASUREMENT_SPECIES_SELECTOR.showLatin({getElement:context.getElement,latinNames:{IHLAMUR:'Tilia'}});
  assert.equal(elements.latinName.textContent,'🔬 Tilia');
});

test('measurement modules load before the locked service and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js');
  const paths=['src/adapters/trees/reverse-geocode.js','src/adapters/trees/load-measurement-photo.js','src/ui/measurement-photo-summary.js','src/ui/measurement-gps-button.js','src/ui/measurement-species-selector.js'];
  const service=head.indexOf('src/services/measure.js');
  for(const path of paths){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<service,`${path} must load before measure.js`);assert.ok(sw.includes(`'/${path}'`),`${path} must be precached`);}
});
