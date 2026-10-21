import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/build-waypoint-navigation-header.js',
  'src/ui/render-waypoint-navigation-header.js',
  'src/application/map/select-nearest-waypoint.js',
  'src/application/map/advance-waypoint-target.js',
  'src/ui/waypoint-navigation-feedback.js'
];
function app(){const context=vm.createContext({window:{}});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return context.window;}

test('navigation header preserves no-GPS prompts and leaves GPS target readout to the overlay',()=>{
  const window=app(),elements={navDist:{textContent:'4'},navTarget:{textContent:'old'},navArrow:{style:{}},navGps:{textContent:''}};
  const getElement=id=>elements[id];
  const noGps=window.DG_BUILD_WAYPOINT_NAVIGATION_HEADER.build({gps:null,target:{wp_id:12}});
  window.DG_RENDER_WAYPOINT_NAVIGATION_HEADER.render({model:noGps,getElement});
  assert.equal(elements.navDist.textContent,'—');assert.equal(elements.navTarget.textContent,'Hedef: P12');assert.equal(elements.navArrow.style.transform,'rotate(0)');assert.equal(elements.navGps.textContent,'GPS konumu bekleniyor; hedef seçebilirsiniz.');
  const withGps=window.DG_BUILD_WAYPOINT_NAVIGATION_HEADER.build({gps:{accuracy:8.6},target:{wp_id:12}});
  window.DG_RENDER_WAYPOINT_NAVIGATION_HEADER.render({model:withGps,getElement});
  assert.equal(elements.navDist.textContent,'—');assert.equal(elements.navTarget.textContent,'Hedef: P12');assert.equal(elements.navGps.textContent,'GPS doğruluğu: ±9 m');
});

test('nearest target keeps the GPS gate, empty notice and selection order',()=>{
  const window=app(),events=[];
  const ports={waypoints:[{id:2}],distance:()=>0,nearest:()=>({id:2}),onGpsRequired:()=>events.push('gps-required'),onEmpty:()=>events.push('empty'),onSelect:id=>events.push(['select',id])};
  assert.equal(window.DG_SELECT_NEAREST_WAYPOINT.select({...ports,gps:null}).status,'gps-required');
  assert.equal(window.DG_SELECT_NEAREST_WAYPOINT.select({...ports,gps:{latitude:1,longitude:2},nearest:()=>null}).status,'empty');
  assert.equal(window.DG_SELECT_NEAREST_WAYPOINT.select({...ports,gps:{latitude:1,longitude:2}}).status,'selected');
  assert.deepEqual(events,['gps-required','empty',['select',2]]);
});

test('advance target delegates wrap/order to the domain and selects only a pending result',()=>{
  const window=app(),events=[];
  const result={id:4,wp_id:1};
  assert.equal(window.DG_ADVANCE_WAYPOINT_TARGET.advance({waypoints:[],currentId:99,next:()=>null,onEmpty:()=>events.push('empty'),onSelect:()=>events.push('select')}).status,'empty');
  const selected=window.DG_ADVANCE_WAYPOINT_TARGET.advance({waypoints:[result],currentId:99,next:(rows,id)=>{events.push(['next',id]);return rows[0];},onEmpty:()=>events.push('empty'),onSelect:id=>events.push(['select',id])});
  assert.equal(selected.status,'selected');assert.deepEqual(events,['empty',['next',99],['select',4]]);
});

test('navigation feedback preserves the warning and triggers GPS activation once',()=>{
  const window=app(),events=[];
  window.DG_WAYPOINT_NAVIGATION_FEEDBACK_UI.gpsRequired({translate:value=>'EN:'+value,notify:(...args)=>events.push(args),startGps:()=>events.push('start-gps')});
  window.DG_WAYPOINT_NAVIGATION_FEEDBACK_UI.noPending({translate:value=>'EN:'+value,notify:(...args)=>events.push(args)});
  assert.deepEqual(events,[['EN:En yakın noktayı seçmek için önce konumu etkinleştirin.','warn','📡'],'start-gps',['EN:Bekleyen ölçüm noktası kalmadı.','info']]);
});

test('all five modules load before map.js and are precached',()=>{
  const head=read('partials/head.html'),worker=read('sw.js'),service=head.indexOf('src/services/map.js');
  for(const path of modules){const index=head.indexOf(path);assert.ok(index>=0&&index<service,path+' must load before map.js');assert.ok(worker.includes("'/"+path+"'"),path+' must be precached');}
});
