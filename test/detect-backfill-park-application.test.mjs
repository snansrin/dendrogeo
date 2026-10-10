import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/detect-backfill-park.js',import.meta.url),'utf8'),context);
const create=context.window.DG_BACKFILL_PARK_DETECTION_APPLICATION.create;

function setup({near=[null,null],byName=null}={}){
  const calls=[];
  let nearIndex=0;
  const detect=create({
    queryNear:async(lat,lon,radius)=>{calls.push(['near',lat,lon,radius]);return near[nearIndex++];},
    queryByName:async(lat,lon,name)=>{calls.push(['name',lat,lon,name]);return byName;},
    sleep:async ms=>calls.push(['sleep',ms])
  });
  return{detect,calls};
}

test('searches nearby first and stops without waiting when the first radius finds a park',async()=>{
  const candidates=[{id:1}];
  const{detect,calls}=setup({near:[candidates]});
  assert.equal(JSON.stringify(await detect(39.9,32.8,'Göksu')),JSON.stringify({cands:candidates,yol:'1500 m'}));
  assert.deepEqual(calls,[['near',39.9,32.8,1500]]);
});

test('falls back through the wider radius and then name search with the established delays',async()=>{
  const candidates=[{id:2}];
  const{detect,calls}=setup({near:[null,[]],byName:candidates});
  assert.equal(JSON.stringify(await detect(39,32,'Dikmen Vadisi')),JSON.stringify({cands:candidates,yol:'ad araması'}));
  assert.deepEqual(calls,[['near',39,32,1500],['sleep',2100],['near',39,32,3500],['sleep',2100],['name',39,32,'Dikmen Vadisi']]);
});

test('returns the existing no-match result after all search stages',async()=>{
  const{detect,calls}=setup({near:[null,null]});
  assert.equal(JSON.stringify(await detect(39,32,'Olmayan park')),JSON.stringify({cands:null,yol:'bulunamadı'}));
  assert.equal(calls.filter(call=>call[0]==='sleep').length,2);
});
