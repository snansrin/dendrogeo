import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const MODULES=[
  'src/domain/surface/geometry-bounds.js',
  'src/domain/surface/utm-projection.js',
  'src/domain/surface/clip-polygon-rect.js',
  'src/domain/surface/clip-polygon-convex.js',
  'src/domain/surface/projected-geometry-area.js',
];
function load(modular){
  const context=vm.createContext({window:null,Math,Number,Array,Object,JSON,Error});context.window=context;
  if(modular)for(const path of MODULES)vm.runInContext(read(path),context,{filename:path});
  vm.runInContext(read('src/services/lc-geo.js'),context,{filename:'src/services/lc-geo.js'});
  return context;
}

test('five geometry modules preserve the locked projection and clipping results',()=>{
  const legacy=load(false),modular=load(true);
  const expressions=[
    'dgLcBboxFromGeometry([[[39,32],[40,33]]],[[[38,31]]])',
    'dgLcUtmEpsgForLatLon(-33.87,151.21)',
    'dgLcUtmForward(39.9334,32.8597,32636)',
    'dgLcUtmInverse(487000,4419000,32636)',
    'dgLcRingBBoxXY([{x:0,y:1},{x:3,y:4}])',
    'dgLcBboxOverlap({minX:0,minY:0,maxX:10,maxY:10},{minX:10,minY:0,maxX:20,maxY:10})',
    'dgLcClipPolygonRect([{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}],{minX:1,minY:1,maxX:3,maxY:3})',
    'dgLcClipPolygonConvex([{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}],[{x:1,y:1},{x:1,y:3},{x:3,y:3},{x:3,y:1}])',
    'dgLcQuadBBox([{x:1,y:4},{x:3,y:2}])',
    'dgLcPlanarArea([{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}])',
    'dgLcProjectedArea(dgLcProjectGeometry([[[39.9,32.8],[39.9,32.9],[39.95,32.9],[39.9,32.8]]],[],32636))',
    '(()=>{const g=dgLcProjectGeometry([[[39.9,32.8],[39.9,32.9],[39.95,32.9],[39.9,32.8]]],[],32636);const q=dgLcClipPolygonRect(g.outer[0],g.outer[0]._bbox);return dgLcIntersectionArea(g.outer,[],g.outer[0]._bbox)+dgLcIntersectionAreaConvex(g.outer,[],Object.assign(q,{_bbox:dgLcQuadBBox(q)}));})()',
  ];
  for(const expression of expressions){
    const oldValue=vm.runInContext(`JSON.stringify(${expression})`,legacy);
    const newValue=vm.runInContext(`JSON.stringify(${expression})`,modular);
    assert.equal(newValue,oldValue,expression);
  }
});

test('all five geometry modules are lazy-loaded before lc-geo and remain precached',()=>{
  const lazy=read('src/utils/lazylibs.js');const service=lazy.indexOf('"src/services/lc-geo.js"');
  const sw=read('sw.js');const core=sw.slice(sw.indexOf('const CORE_ASSETS'),sw.indexOf('];',sw.indexOf('const CORE_ASSETS')));
  for(const path of MODULES){assert.ok(lazy.indexOf(`"${path}"`)>=0&&lazy.indexOf(`"${path}"`)<service,path);assert.ok(core.includes(`/${path}`),path);}
});
