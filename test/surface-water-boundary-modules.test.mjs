import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/domain/surface/surface-water-footprint-policy.js',
 'src/domain/surface/classify-surface-water-outside-cell.js',
 'src/domain/surface/select-surface-water-outside-parts.js',
 'src/domain/surface/count-unresolved-surface-water-parts.js',
 'src/domain/surface/requires-surface-water-scan.js'
];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array,Set});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('water footprint policy accepts only explicit boundaries or the validated park OSM footprint',()=>{
 const p=setup().DG_SURFACE_WATER_FOOTPRINT_POLICY,valid=f=>f.valid;
 assert.equal(p.hasExplicit({features:[{type:'water',method:'visual-boundary'}]}),true);
 assert.equal(p.hasVerified({useObjects:true,objectFeatures:[{type:'water',method:'osm-boundary',osmId:'way/423602740',valid:true}]},valid),true);
 assert.equal(p.hasVerified({useObjects:false,objectFeatures:[{type:'water',method:'osm-boundary',osmId:'way/423602740',valid:true}]},valid),false);
 assert.equal(p.hasVerified({useObjects:true,objectFeatures:[{type:'water',method:'osm-boundary',osmId:'way/other',valid:true}]},valid),false);
 assert.equal(p.hasVerified({useObjects:true,objectFeatures:[{type:'water',method:'osm-boundary',osmId:'way/423602740',valid:false}]},valid),false);
});

test('water outside classification prioritizes reviewed cell decisions and spectral evidence',()=>{
 const classify=setup().DG_CLASSIFY_SURFACE_WATER_OUTSIDE_CELL.classify,cell={row:1,col:1},cellKey=c=>c.row+':'+c.col;
 assert.equal(classify({cell,record:{corrections:{'1:1':{to:'hard',method:'visual-cell'}}},cellKey}), 'hard');
 assert.equal(classify({cell,record:{profile:{cells:{'1:1':{signal:1}}}},cellKey,landPredict:()=> 'bare'}), 'bare');
 assert.equal(classify({cell,record:{corrections:{'1:1':{to:'green',method:'sensitivity'}}},cellKey,editing:false}), 'green');
});

test('mixed shoreline cells inherit the nearest non-water class with stable tie ordering',()=>{
 const classify=setup().DG_CLASSIFY_SURFACE_WATER_OUTSIDE_CELL.classify,cellKey=c=>c.row+':'+c.col,cell={row:0,col:0};
 const cells=[cell,{row:0,col:1,classKey:'hard'},{row:1,col:0,classKey:'green'}];
 assert.equal(classify({cell,record:{},cells,cellKey}), 'green');
 assert.equal(classify({cell,record:{},cells:[cell],cellKey}), 'other');
});

test('outside-part selection and unresolved count keep reviewed raster-water cells unique',()=>{
 const w=setup(),select=w.DG_SELECT_SURFACE_WATER_OUTSIDE_PARTS.select,count=w.DG_COUNT_UNRESOLVED_SURFACE_WATER_PARTS.count;
 const parts=[{key:'a',cell:{classKey:'water'},method:'review-cell',type:'other'},{key:'a',cell:{classKey:'water'},method:'review-cell',type:'other'},{key:'b',cell:{classKey:'green'},method:'review-cell',type:'other'},{key:'c',cell:{classKey:'water'},method:'sensitivity',type:'other'}];
 const selected=select(parts);assert.equal(selected.length,2);assert.equal(count(selected),1);
});

test('scan requirement and lazy/precache wiring preserve all five surface-water modules',()=>{
 const requires=setup().DG_REQUIRES_SURFACE_WATER_SCAN.requires;
 assert.equal(requires({hasFootprint:false,parts:[{}],profile:null}),false);
 assert.equal(requires({hasFootprint:true,parts:[],profile:null}),false);
 assert.equal(requires({hasFootprint:true,parts:[{}],profile:{cells:{}}}),false);
 assert.equal(requires({hasFootprint:true,parts:[{}],profile:null}),true);
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 assert.match(ui,/DG_SURFACE_WATER_FOOTPRINT_POLICY/);assert.match(ui,/DG_CLASSIFY_SURFACE_WATER_OUTSIDE_CELL/);assert.match(ui,/DG_SELECT_SURFACE_WATER_OUTSIDE_PARTS/);assert.match(ui,/DG_COUNT_UNRESOLVED_SURFACE_WATER_PARTS/);assert.match(ui,/DG_REQUIRES_SURFACE_WATER_SCAN/);
});
