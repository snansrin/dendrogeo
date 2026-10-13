import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/surface/classify-surface-review-data-change.js',
  'src/application/surface/reset-surface-review-data-change.js',
  'src/application/surface/prepare-surface-review-session.js',
  'src/ui/mount-surface-review-map-host.js',
  'src/application/surface/finish-surface-review-mount.js'
];
function setup(){const window={};const context=vm.createContext({window,Object});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('review fingerprint policy only invalidates an existing mismatched fingerprint',()=>{
  const changed=setup().DG_CLASSIFY_SURFACE_REVIEW_DATA_CHANGE.changed;
  assert.equal(changed({savedFingerprint:null,nextFingerprint:'new'}),false);
  assert.equal(changed({savedFingerprint:'same',nextFingerprint:'same'}),false);
  assert.equal(changed({savedFingerprint:'old',nextFingerprint:'new'}),true);
});

test('data change clears source-dependent decisions and accepted snapshots only',()=>{
  const reset=setup().DG_RESET_SURFACE_REVIEW_DATA_CHANGE.reset,record={fingerprint:'old',parkId:7,corrections:{x:1},features:[1],objectFeatures:[2],profile:{cells:{}},acceptedAt:'time',acceptedAreas:{green:2},acceptedResult:{areas:{green:2}}};
  assert.equal(reset(record),record);assert.equal(record.fingerprint,'old');assert.equal(record.parkId,7);
  for(const key of ['corrections','features','objectFeatures','profile','acceptedAt','acceptedAreas','acceptedResult'])assert.deepEqual(JSON.parse(JSON.stringify(record[key])),key==='corrections'?{}:key==='features'?[]:null);
});

test('session preparation derives accepted versus draft state and preserves the missing-snapshot notice',()=>{
  const prepare=setup().DG_PREPARE_SURFACE_REVIEW_SESSION.prepare,state={},messages=[],record={displayOpacity:30,serverRevision:4,draftDirty:false,acceptedAt:'time',acceptedResult:null};
  prepare({state,record,cells:[{epsg:32635}],status:message=>messages.push(message)});
  assert.equal(state.record,record);assert.equal(state.opacity,30);assert.equal(state.revision,4);assert.equal(state.editing,true);assert.equal(state.epsg,32635);assert.deepEqual(messages,['Önceki kabul alanları hesabınızda korunuyor. Bu yeni harita önizlemesini kontrol edip kaydedin.']);
});

test('map host setup moves the editor, hides baseline and installs a resize observer',()=>{
  const mount=setup().DG_MOUNT_SURFACE_REVIEW_MAP_HOST.mount,calls=[],host={parentNode:'parent',nextSibling:'sibling',style:{}},mapEl={classList:{add:value=>calls.push(['map-class',value])}},workspace={after:element=>calls.push(['after',element])};
  const document={getElementById:id=>({map:mapEl,surfaceMapWorkspace:workspace,baseLayerSelect:{value:'sat'},'v-map':{classList:{add:value=>calls.push(['view-class',value])}}}[id]||null)};
  const map={hasLayer:layer=>layer==='baseline',removeLayer:layer=>calls.push(['remove',layer]),invalidateSize:opts=>calls.push(['invalidate',opts])};
  class Observer{constructor(cb){this.cb=cb;}observe(el){calls.push(['observe',el]);}disconnect(){calls.push(['disconnect']);}}
  const state={base:'osm',resizeObserver:{disconnect:()=>calls.push(['old-disconnect'])}};
  mount({host,document,map,state,baselineLayer:'baseline',switchBaseLayer:value=>calls.push(['base',value]),ResizeObserverCtor:Observer});
  assert.equal(state.hostParent,'parent');assert.equal(state.hostNext,'sibling');assert.equal(state.baselineShown,true);assert.equal(state.base,'sat');assert.equal(host.style.display,'block');
  assert.ok(calls.some(call=>call[0]==='after'));assert.ok(calls.some(call=>call[0]==='remove'));assert.ok(calls.some(call=>call[0]==='observe'));
});

test('mount finalization ignores stale epochs and starts optional water discovery after a valid partition',async()=>{
  const finish=setup().DG_FINISH_SURFACE_REVIEW_MOUNT.finish,record={acceptedResult:{},useObjects:true,objectFeatures:[]},calls=[];
  assert.equal(await finish({record,epoch:2,isCurrent:()=>false,repartition:async()=>true,canRenderAccepted:()=>true,renderAccepted:()=>calls.push('accepted'),hidePending:()=>calls.push('hide'),scrollHost:()=>calls.push('scroll'),autoWater:()=>calls.push('water')}),false);
  assert.deepEqual(calls,[]);
  assert.equal(await finish({record,epoch:3,isCurrent:()=>true,repartition:async()=>true,canRenderAccepted:()=>true,renderAccepted:()=>calls.push('accepted'),hidePending:()=>calls.push('hide'),scrollHost:()=>calls.push('scroll'),autoWater:()=>calls.push('water')}),true);
  assert.deepEqual(calls,['accepted','hide','scroll','water']);
});

test('mount lifecycle modules load before locked UI and are precached',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
  for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
  for(const name of ['DG_CLASSIFY_SURFACE_REVIEW_DATA_CHANGE','DG_RESET_SURFACE_REVIEW_DATA_CHANGE','DG_PREPARE_SURFACE_REVIEW_SESSION','DG_MOUNT_SURFACE_REVIEW_MAP_HOST','DG_FINISH_SURFACE_REVIEW_MOUNT'])assert.ok(ui.includes(name));
});
