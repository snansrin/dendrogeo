import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/parks/park-export-formats.js',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../src/ui/park-export.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const formats=context.window.DG_PARK_EXPORT_FORMATS;

test('grid GeoJSON preserves property names, null defaults, and rectangle fallback',()=>{
 const encoded=JSON.parse(JSON.stringify(formats.gridGeoJSON([
  {id:'A1',n:0,areaM2:0,clearanceM:0,lat:0,lon:32,w0:32,w1:32.1,s0:40,s1:40.1},
  {id:'B2',n:3,areaM2:25,clearanceM:4,lat:null,lon:null,geometry:{type:'MultiPolygon',coordinates:[]}}
 ])));
 assert.equal(encoded.type,'FeatureCollection');
 assert.deepEqual(encoded.features[0].properties,{id:'A1',olcum:0,alan_m2:null,guvenlik_m:null,waypoint_lat:0,waypoint_lon:32,durum:'bos'});
 assert.deepEqual(encoded.features[0].geometry,{type:'Polygon',coordinates:[[[32,40],[32.1,40],[32.1,40.1],[32,40.1],[32,40]]]});
 assert.deepEqual(encoded.features[1].geometry,{type:'MultiPolygon',coordinates:[]});
 assert.equal(encoded.features[1].properties.durum,'olculmus');
});

test('waypoint CSV retains its header, order, and visited flag encoding',()=>{
 assert.equal(formats.waypointsCSV([
  {wp_id:1,lat:40.1,lon:32.2,visited:true},
  {wp_id:2,lat:40.3,lon:32.4,visited:false}
 ]),'wp_id,lat,lon,visited\n1,40.1,32.2,1\n2,40.3,32.4,0\n');
});

test('format module loads before park export and is present in the service-worker cache',()=>{
 assert.ok(index.indexOf('src/domain/parks/park-export-formats.js')<index.indexOf('src/ui/park-export.js'));
 assert.match(index,/src\/domain\/parks\/park-export-formats\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/domain\/parks\/park-export-formats\.js/);
 assert.match(adapter,/DG_PARK_EXPORT_FORMATS\.gridGeoJSON\(DG_GRID_SESSION\.getCells\(\)\)/);
 assert.match(adapter,/DG_PARK_EXPORT_FORMATS\.waypointsCSV\(rows\)/);
});
