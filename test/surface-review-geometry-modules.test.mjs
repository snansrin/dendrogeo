import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/application/surface/build-surface-review-parts.js',
 'src/domain/surface/summarize-surface-review-areas.js',
 'src/domain/surface/build-adjusted-surface-summary.js',
 'src/application/surface/render-surface-review-geometry.js',
 'src/domain/surface/build-surface-boundary-geojson.js'
];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array,Promise});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('resolved-part memo reuses matching state and invalidates changed feature identity',()=>{
 const build=setup().DG_BUILD_SURFACE_REVIEW_PARTS.build,record={sens:{green:50},corrections:{},profile:{}},geometry={},park={},cells=[{}],features=[{}],resolved=()=>[{type:'green'}];
 const args={record,geometry,park,cells,epoch:1,partitionVersion:2,visualVersion:3,editing:true,features,sens:record.sens,corrections:record.corrections,profile:record.profile,epsg:32636,memo:null,resolved,effective:()=> 'green'};
 const first=build(args),same=build({...args,memo:first.memo});assert.equal(same.memo,first.memo);
 const next=build({...args,memo:first.memo,features:[{}]});assert.notEqual(next.memo,first.memo);
 assert.deepEqual(JSON.parse(JSON.stringify(build({...args,cells:[]}))),{parts:[],memo:null});
});

test('area summary memo and adjusted report preserve totals and correction counts',()=>{
 const w=setup(),summarize=w.DG_SUMMARIZE_SURFACE_REVIEW_AREAS.summarize,adjust=w.DG_BUILD_ADJUSTED_SURFACE_SUMMARY.build;
 const record={corrections:{a:{},b:{}}},memo={},areas={green:80};let calls=0;
 const args={record,geometry:{},parts:[],memo,rasterAreas:{green:100},summarizeParts:()=>{calls++;return areas;}};
 assert.equal(summarize(args),areas);assert.equal(summarize(args),areas);assert.equal(calls,1);
 assert.deepEqual(JSON.parse(JSON.stringify(adjust({areas,rasterAreas:{green:100},record}))),{raster:{green:100},corrected:areas,n:2,nCorrected:2,nConfirmed:0});
 assert.equal(summarize({...args,record:null}),null);
});

test('visual geometry shares pending work, uses accepted output and falls back from absent worker results',async()=>{
 const render=setup().DG_RENDER_SURFACE_REVIEW_GEOMETRY.render,parts=[{type:'green',geom:[],areaM2:2,method:'review-cell'}],geometry={},state={memo:null},features=[{id:1}],display=[{id:2}];let jobs=0;
 const args={epoch:1,partitionVersion:2,parts,geometry,epsg:32636,park:{},record:{},rawView:false,editing:true,memo:null,getMemo:()=>state.memo,setMemo:value=>{state.memo=value;},workerJob:async()=>{jobs++;return null;},mergeSync:()=>features,displaySync:()=>display};
 const first=render(args),same=render({...args,memo:state.memo});assert.equal(first,same);const result=await first;assert.equal(jobs,1);assert.equal(result.features,features);assert.equal(result.displayFeatures,display);
 const accepted={features,displayFeatures:display,displayMethod:{version:4}},reuse=await render({...args,record:{acceptedResult:accepted},editing:false});assert.equal(reuse.features,features);assert.equal(jobs,1);
});

test('boundary GeoJSON skips invalid/small geometry and clips valid features with legacy properties',()=>{
 const build=setup().DG_BUILD_SURFACE_BOUNDARY_GEOJSON.build,warnings=[],record={features:[{type:'water',method:'visual-boundary',osmId:'way/1'},{type:'hard'}]};
 const result=build({record,rawView:false,parkGeometry:{park:true},epsg:32636,validFeature:f=>f.type==='water',featureGeometry:f=>f,clip:(_op,feature)=>[feature],area:()=>1,unproject:geometry=>geometry,warn:(...args)=>warnings.push(args)});
 assert.equal(result.features.length,1);assert.deepEqual(JSON.parse(JSON.stringify(result.features[0].properties)),{class:'water',source:'visual-boundary',osmId:'way/1'});
 const empty=build({record,rawView:true,parkGeometry:{},epsg:32636});assert.deepEqual(JSON.parse(JSON.stringify(empty)),{type:'FeatureCollection',features:[]});
});

test('five review geometry modules load before the locked service and are precached',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 assert.match(ui,/DG_BUILD_SURFACE_REVIEW_PARTS/);assert.match(ui,/DG_SUMMARIZE_SURFACE_REVIEW_AREAS/);assert.match(ui,/DG_BUILD_ADJUSTED_SURFACE_SUMMARY/);assert.match(ui,/DG_RENDER_SURFACE_REVIEW_GEOMETRY/);assert.match(ui,/DG_BUILD_SURFACE_BOUNDARY_GEOJSON/);
});
