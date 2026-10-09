import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function field() {
  const elements = new Map(), writes = [], messages = [], events = {};
  const el = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', files: [], style: {}, dataset: {}, disabled: false,
      innerHTML: '', textContent: '', attributes: {},
      setAttribute(k,v) { this.attributes[k] = v; },
      focus() { this.focused = true; }
    });
    return elements.get(id);
  };
  const db = table => {
    const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; },
      maybeSingle() { return Promise.resolve({data:{id:7,name:'Test Park'},error:null}); },
      insert(row) { writes.push({table,row}); return Promise.resolve({error:null}); },
      update(row) { writes.push({table,row}); return q; },
      then(resolve,reject) { return Promise.resolve({data:[],error:null}).then(resolve,reject); }
    };return q;
  };
  const ctx = vm.createContext({
    $, document: {addEventListener() {},createElement() { throw Error('No canvas'); }},
    window: {addEventListener(name,fn) { events[name] = fn; }},
    localStorage: {setItem() {}}, navigator: {onLine:true}, URL,
    GPS: {latitude:40,longitude:32,accuracy:5,altitude:null}, EDIT_ID:null,
    photoOk:false, USER:{id:'test-user'}, PROJ_LIST:[{id:1,park_id:7}], DG_PARK_SCHEMA_OK:true,
    sb:{from:db,storage:{from:()=>({upload:async()=>({error:Error('upload failed')})})}},
    toast:(...args)=>messages.push(args), esc:s=>String(s),
    fetch:async()=>{throw Error('offline');}, uuidv4:()=> 'test-client',
    dgVerifyAtPark:async()=>({ok:true,verified:false}), dgGeoStamp() {},
    loadDash() {},loadRecords() {},loadWaypoints() {}, dgParkGate() {},
    saveOfflineMeasurement:async row=>writes.push({table:'offline',row}),
    dgCf:s=>s,dgT:s=>s,map:null,drawNav() {}, console
  });
  function $(id) { return el(id); }
  for (const path of ['src/config/measurement-protocol-lock.js','src/config/wood-density-lock.js','src/config/species.js','src/domain/trees/allometry.js','src/application/trees/calculate-tree-carbon.js','src/application/trees/calculate-tree-carbon-from-circumference.js','src/services/allometry.js','src/services/measure.js']) {
    vm.runInContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),ctx,{filename:path});
  }
  for (const [id,value] of Object.entries({mProject:'1',mPoint:'5',mNo:'1',mGroup:'YAPRAKLI',mSpecies:'IHLAMUR',mDbh:'52',mHeight:'7.2'})) el(id).value=value;
  return {ctx,el,writes,messages,events,run:code=>vm.runInContext(code,ctx)};
}

for (const [id,value] of [['mDbh','-1'],['mDbh','0'],['mDbh','Infinity'],['mDbh','1257'],['mHeight','-2'],['mHeight','NaN'],['mHeight','101'],['mPoint','1.2'],['mPoint','-1'],['mNo','0']]) {
  test(`invalid ${id}=${value} focuses the field and never writes`,async()=>{
    const f=field();f.el(id).value=value;
    await f.run('saveMeas()');
    assert.equal(f.writes.length,0);assert.equal(f.el(id).focused,true);
    assert.equal(f.el(id).attributes['aria-invalid'],'true');
    assert.equal(f.el('saveBtn').disabled,false);
    assert.equal(f.el(id).value,value,'invalid entry remains available for correction');
  });
}

test('live carbon derives DBH from measured circumference; invalid input hides stale totals',()=>{
  const f=field(), result=f.run('calcFromCircumference(52,7.2,"IHLAMUR","YAPRAKLI")');
  f.run('liveCalc()');
  assert.match(f.el('liveCalc').innerHTML,new RegExp(result.total_carbon.toFixed(1)));
  assert.ok(f.el('liveCalc').innerHTML.includes(result.bhb.toFixed(1)));
  assert.equal(f.el('measureSaveHint').style.display,'none');
  f.el('mDbh').value='-1';f.run('liveCalc()');
  assert.equal(f.el('liveCalc').style.display,'none');
  assert.equal(f.el('measureSaveHint').style.display,'block');
});

test('successful save clears per-tree values, photo metadata and preview; keeps species and project',async()=>{
  const f=field();f.el('mPhotoName').textContent='previous.jpg';f.run('liveCalc()');
  await f.run('saveMeas()');
  assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].row.girth_cm,52);
  assert.ok(Math.abs(f.writes[0].row.dbh_cm-52/Math.PI)<1e-12);
  assert.equal(f.el('mDbh').value,'');assert.equal(f.el('mHeight').value,'');
  assert.equal(f.el('mPhotoName').textContent,'');assert.equal(f.el('liveCalc').style.display,'none');
  assert.equal(f.el('mSpecies').value,'IHLAMUR');assert.equal(f.el('mProject').value,'1');
});

test('an overlapping save starts only one operation and restores button after rejection',async()=>{
  const f=field();let calls=0, fail;
  f.ctx.dgSaveMeasInner=()=>{calls++;return new Promise((resolve,reject)=>{fail=reject;});};
  const first=f.run('saveMeas()');await f.run('saveMeas()');
  assert.equal(calls,1);assert.equal(f.el('saveBtn').disabled,true);
  fail(Error('network'));await first;
  assert.equal(f.el('saveBtn').disabled,false);assert.equal(f.el('mDbh').value,'52');
  assert.ok(f.messages.some(m=>m[0].includes('Bilgileriniz formda duruyor')));
});

test('photo upload failure does not silently create a measurement without its selected photo',async()=>{
  const f=field();f.el('mPhoto').files=[{name:'tree.jpg'}];
  f.ctx.photoOk=true;f.ctx.compress=async()=>({});
  await f.run('saveMeas()');
  assert.equal(f.writes.length,0);assert.equal(f.el('mDbh').value,'52');
  assert.equal(f.el('mPhoto').files[0].name,'tree.jpg');
});

test('late photo check cannot overwrite a newly cleared photo',async()=>{
  const f=field();let resolveImage;
  f.ctx.loadImg=()=>new Promise(resolve=>{resolveImage=resolve;});
  const check=f.ctx.checkPhoto({target:{files:[{name:'tree.jpg',type:'image/jpeg'}]}});
  f.run('dgClearMeasurePhoto()');resolveImage({i:{},u:'blob:test'});await check;
  assert.equal(f.ctx.photoOk,false);assert.equal(f.el('photoCheck').style.display,'none');
  assert.equal(f.el('mPhotoName').textContent,'');
});

test('offline edit exits editing mode so the next tree cannot overwrite the queued record',async()=>{
  const f=field();f.ctx.EDIT_ID=42;f.ctx.navigator.onLine=false;
  await f.run('saveMeas()');
  assert.equal(f.writes[0].table,'offline');assert.equal(f.writes[0].row._editId,42);
  assert.equal(f.ctx.EDIT_ID,null);assert.equal(f.el('saveBtn').textContent,'💾 Hesapla ve Kaydet');
});

test('language switch preserves the species used for calculations',()=>{
  const f=field();f.events['dg:lang']();
  assert.equal(f.el('mSpecies').value,'IHLAMUR');
  assert.equal(f.el('liveCalc').style.display,'block');
});

test('late point suggestion does not overwrite a manually entered point',async()=>{
  const f=field();f.ctx.GPS=null;f.el('mPoint').value='';let complete;
  f.ctx.sb.from=()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>new Promise(r=>{complete=r;})};return q;};
  const pending=f.run('autoFillPointId()');f.el('mPoint').value='99';f.run('manualPoint=true');
  complete({data:[{point_id:6}]});await pending;
  assert.equal(f.el('mPoint').value,'99');
});
