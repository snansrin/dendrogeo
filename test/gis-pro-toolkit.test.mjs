import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const context={console};
vm.runInNewContext(file('src/gis/geo.js'),context);
const geo=context.DG_GIS_GEO;
test('GIS geometry is a separate frozen read-only helper',()=>{
 assert.ok(Object.isFrozen(geo));
 assert.equal(geo.R,6371008.8);
 assert.equal(geo.distance({lat:0,lng:0},{lat:0,lng:0}),0);
 assert.ok(geo.distance({lat:0,lng:0},{lat:0,lng:1})>111000);
 assert.ok(geo.distance({lat:0,lng:0},{lat:0,lng:1})<111300);
});
test('great-circle distance, length and bearing agree across WGS84 coordinates',()=>{
 const a={lat:39.99,lng:32.65},b={lat:39.99,lng:32.66};
 const d=geo.distance(a,b);
 assert.ok(d>850&&d<860);
 assert.equal(geo.pathLength([a,b]),d);
 assert.equal(geo.pathLength([a,b,a]),2*d);
 assert.ok(Math.abs(geo.bearing(a,b)-90)<0.01);
});
test('area has correct approximate size, handles reversed ring orientation',()=>{
 const p=[{lat:39.99,lng:32.65},{lat:39.99,lng:32.651},{lat:39.991,lng:32.651},{lat:39.991,lng:32.65}];
 const area=geo.polygonArea(p);
 assert.ok(area>9200&&area<9800,area);
 assert.ok(Math.abs(geo.polygonArea(p.slice().reverse())-area)<1e-5);
 assert.equal(geo.polygonArea(p.slice(0,2)),0);
});
test('UTM uses correct EPSG and hemisphere, validates polar limits',()=>{
 const p=geo.utm({lat:39.99,lng:32.65});
 assert.equal(p.zone,36);assert.equal(p.epsg,32636);assert.equal(p.hemisphere,'N');
 assert.ok(p.easting>450000&&p.easting<490000,p.easting);
 assert.ok(p.northing>4400000&&p.northing<4450000,p.northing);
 assert.equal(geo.utm({lat:-10,lng:32.65}).epsg,32736);
 assert.throws(()=>geo.utm({lat:89,lng:40}),/UTM/);
});
test('coordinate DMS output, park polygon hit-testing and validation',()=>{
 assert.match(geo.dms(39.99,true),/K/);
 assert.match(geo.dms(-32.65,false),/B/);
 const ring=[[39.9,32.6],[39.9,32.7],[40.1,32.7],[40.1,32.6]];
 assert.equal(geo.ringContains([40,32.65],ring),true);
 assert.equal(geo.ringContains([40.2,32.65],ring),false);
 assert.throws(()=>geo.point({lat:92,lng:0}),/geçersiz/);
});
test('QGIS GeoJSON and KML encode coordinates [longitude, latitude]',()=>{
 const p=[{lat:39.99,lng:32.65},{lat:40,lng:32.65},{lat:40,lng:32.66}];
 const fc=JSON.parse(JSON.stringify(geo.geojson(p,'area')));
 const f=fc.features[0];
 assert.equal(f.geometry.type,'Polygon');assert.deepEqual(f.geometry.coordinates[0][0],[32.65,39.99]);
 assert.ok(f.properties.area_m2>0);
 assert.ok(f.properties.length_m>0);
 assert.equal(f.properties.crs,'EPSG:4326');
 assert.match(geo.kml(fc),/<Polygon>/);assert.match(geo.kml(fc),/32.65,39.99,0/);
 assert.equal(geo.geojson(p,'line').features[0].geometry.type,'LineString');
});
test('GIS toolbox parses and provides non-destructive functional controls',()=>{
 const script=file('src/gis/toolkit.js');
 assert.doesNotThrow(()=>new vm.Script(script));
 for(const target of ['Koordinat','Mesafe','Alan','Nesne','GeoJSON','KML','CSV','Parkı göster','Ölçek','Konumumu bul']){
  assert.ok(script.includes(target),'missing GIS tool '+target);
 }
 assert.match(script,/isEditing\(\)/);
 assert.match(script,/navigator\.geolocation/);
 assert.match(script,/navigator\.clipboard/);
 assert.match(script,/Nominatim|nominatim/);
 assert.match(script,/L\.control\.scale/);
 assert.doesNotMatch(script,/sb\.from\(|\.upsert\(|supabase\.from\(/,'GIS tooling must never write approved data');
});
test('GIS toolbox assets load in production and offline and core lock remains',()=>{
 const head=file('partials/head.html'),sw=file('sw.js');
 const lock=JSON.parse(file('docs/surface-engine-lock.json'));
 for(const path of ['src/gis/geo.js','src/gis/toolkit.js','css/gis-toolkit.css']){
  assert.match(head,new RegExp(path.replaceAll('.','\\.')+'\\?v='));
  assert.ok(sw.includes('/'+path),'not in offline assets: '+path);
  assert.equal(lock.locked_files[path],undefined,'GIS module belongs outside locked baseline');
 }
 assert.match(sw,/dendrogeo-sw-v2-r93/);
 const css=file('css/gis-toolkit.css');
 assert.match(css,/#v-map/);assert.match(css,/var\(--line\)/);
 assert.match(css,/@media\(max-width:640px\)/);
});
