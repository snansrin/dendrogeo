import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/trees/format-measurement-gps-readout.js',
  'src/ui/measurement-gps-readout.js',
  'src/adapters/trees/update-measurement-gps-map-marker.js',
  'src/ui/measurement-gps-active-state.js',
  'src/application/trees/refresh-measurement-gps-view.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('GPS readout preserves exact accuracy thresholds, formatting and labels',()=>{
  const{window}=setup();
  const excellent=window.DG_FORMAT_MEASUREMENT_GPS_READOUT.format({accuracy:9.6,latitude:41.1234567,longitude:29.9876543,altitude:18.7});
  assert.deepEqual(JSON.parse(JSON.stringify(excellent)),{accuracy:'10',latitude:'41.123457',longitude:'29.987654',altitude:'19 m',quality:'ÇOK İYİ',ringClass:'gpsring good',badgeText:'GPS aktif · ±10 m · ÇOK İYİ',badgeClass:'dg-png-badge'});
  assert.equal(window.DG_FORMAT_MEASUREMENT_GPS_READOUT.format({accuracy:20,latitude:0,longitude:0,altitude:null}).quality,'ORTA');
  assert.equal(window.DG_FORMAT_MEASUREMENT_GPS_READOUT.format({accuracy:40,latitude:0,longitude:0,altitude:NaN}).badgeClass,'dg-png-badge red');
});

test('GPS readout and active state update established DOM fields and classes',()=>{
  const{window}=setup(),events=[],elements={};
  for(const id of ['gpsAcc','gLat','gLon','gAlt','gQ','gpsRing','gpsBadge','gpsState'])elements[id]={textContent:'',className:''};
  elements.gpsBtn={textContent:'',dataset:{},classList:{add:value=>events.push(value)}};
  const element=id=>elements[id],view=window.DG_FORMAT_MEASUREMENT_GPS_READOUT.format({accuracy:12,latitude:1,longitude:2,altitude:null});
  window.DG_MEASUREMENT_GPS_READOUT_UI.render(view,element);window.DG_MEASUREMENT_GPS_ACTIVE_STATE_UI.render(view,element);
  assert.equal(elements.gLat.textContent,'1.000000');assert.equal(elements.gAlt.textContent,'—');assert.equal(elements.gQ.textContent,'İYİ');
  assert.equal(elements.gpsRing.className,'gpsring mid');assert.equal(elements.gpsBadge.textContent,'GPS aktif · ±12 m · İYİ');assert.equal(elements.gpsState.className,'alert ok');
  assert.equal(elements.gpsBtn.textContent,'GPS aktif');assert.equal(elements.gpsBtn.dataset.oldText,'GPS aktif');assert.deepEqual(events,['is-active']);
});

test('GPS map marker replaces only the previous marker and keeps the field popup',()=>{
  const{window}=setup(),events=[],previous={id:'old'},marker={addTo(map){events.push(['add',map]);return this;},bindPopup(value){events.push(['popup',value]);return this;}},map={removeLayer(value){events.push(['remove',value]);}};
  const result=window.DG_UPDATE_MEASUREMENT_GPS_MAP_MARKER.update(map,{latitude:41,longitude:29},{getCurrentMarker:()=>previous,setCurrentMarker:value=>events.push(['set',value]),createMarker:(coordinates,options)=>{events.push(['create',coordinates,options]);return marker;}});
  assert.equal(result,marker);assert.deepEqual(events.map(event=>event[0]),['remove','create','add','popup','set']);assert.equal(events[3][1],'Konumun');
  assert.equal(window.DG_UPDATE_MEASUREMENT_GPS_MAP_MARKER.update(null,{latitude:0,longitude:0},{getCurrentMarker:()=>null}),null);
});

test('GPS view refresh retains DOM, marker, navigation and point-suggestion order',()=>{
  const{window}=setup(),events=[],coords={accuracy:5,latitude:41,longitude:29,altitude:10};
  const result=window.DG_REFRESH_MEASUREMENT_GPS_VIEW.refresh({getGPS:()=>coords,format:value=>({accuracy:value.accuracy}),renderReadout:view=>events.push(['readout',view.accuracy]),renderActive:view=>events.push(['active',view.accuracy]),updateMarker:value=>events.push(['marker',value.latitude]),drawNavigation:()=>events.push('nav'),suggestPoint:()=>events.push('suggest')});
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['readout','active','marker','nav','suggest']);assert.equal(result.accuracy,5);
  assert.equal(window.DG_REFRESH_MEASUREMENT_GPS_VIEW.refresh({getGPS:()=>null}),undefined);
});

test('GPS view modules load before measure, are precached and own the legacy updater presentation',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/measure.js'),measure=head.indexOf('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<measure,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.ok(service.includes('DG_REFRESH_MEASUREMENT_GPS_VIEW.refresh'));assert.ok(service.includes('function updGps(){'));
  assert.ok(read('src/domain/trees/format-measurement-gps-readout.js').includes('accuracy<10'));
});
