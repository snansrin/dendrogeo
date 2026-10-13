import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/application/surface/select-surface-scan-period.js',
 'src/application/surface/update-surface-sensitivity.js',
 'src/application/surface/focus-surface-class.js',
 'src/application/surface/toggle-surface-candidates.js',
 'src/application/surface/select-surface-basemap.js'
];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('scan period keeps editing gates and normalizes supported period values',()=>{
 const module=setup().DG_SELECT_SURFACE_SCAN_PERIOD,calls=[],state={record:{},rawView:false,brush:null,busy:false,saving:false};
 module.select({state,value:'latest',scan:()=>calls.push('scan')});assert.equal(state.record.period,'latest');assert.equal(state.record.periodExplicit,true);assert.deepEqual(calls,['scan']);
 module.select({state,value:'anything',scan:()=>calls.push('scan')});assert.equal(state.record.period,'ytd');assert.equal(calls.length,2);
 for(const gate of [{rawView:true},{brush:{}},{busy:true},{saving:true},{record:null}])module.select({state:{...state,...gate,record:gate.record===null?null:state.record},value:'ref',scan:()=>calls.push('blocked')});assert.equal(calls.length,2);
});

test('sensitivity clamps input, enables spectral review and runs the existing debounce ports',()=>{
 const module=setup().DG_UPDATE_SURFACE_SENSITIVITY,calls=[],scheduled=[],state={record:{sens:{}},rawView:false,brush:null,busy:false,saving:false,debounce:7};
 const changed=module.update({state,type:'green',value:'140',classes:['green','water'],dirty:()=>calls.push('dirty'),clearTimer:id=>calls.push(`clear:${id}`),setTimer:(fn,delay)=>(scheduled.push({fn,delay}),8),refresh:()=>calls.push('refresh'),summary:()=>calls.push('summary'),status:()=>calls.push('status')});
 assert.equal(changed,true);assert.equal(state.record.sens.green,100);assert.equal(state.record.spectralEnabled,true);assert.equal(state.focus,'green');assert.equal(state.showCand,true);assert.deepEqual(calls,['dirty','clear:7']);assert.equal(scheduled[0].delay,250);scheduled[0].fn();assert.equal(state.debounce,null);assert.deepEqual(calls,['dirty','clear:7','refresh','summary','status']);
 for(const gate of [{rawView:true},{brush:{}},{busy:true},{saving:true},{record:null}])assert.equal(module.update({state:{...state,...gate,record:gate.record===null?null:state.record},type:'green',value:2,classes:['green'],dirty(){},clearTimer(){},setTimer(){},refresh(){},summary(){},status(){}}),false);
});

test('class focus and candidate visibility only call their existing view ports',()=>{
 const w=setup(),calls=[],state={focus:null,showCand:false};w.DG_FOCUS_SURFACE_CLASS.focus({state,type:'water',refresh:()=>calls.push('refresh')});
 w.DG_TOGGLE_SURFACE_CANDIDATES.toggle({state,on:1,refresh:()=>calls.push('refresh'),render:()=>calls.push('render')});assert.equal(state.focus,'water');assert.equal(state.showCand,true);assert.deepEqual(calls,['refresh','refresh','render']);
});

test('basemap accepts only the existing layer choices',()=>{
 const module=setup().DG_SELECT_SURFACE_BASEMAP,calls=[],state={base:'sat'};
 module.select({state,type:'topo',switchLayer:type=>calls.push(type)});assert.equal(state.base,'topo');assert.deepEqual(calls,['topo']);
 module.select({state,type:'unknown',switchLayer:type=>calls.push(type)});assert.equal(state.base,'topo');assert.deepEqual(calls,['topo']);
});

test('five map-control modules load before locked UI, are precached, and are delegated',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 for(const key of ['DG_SELECT_SURFACE_SCAN_PERIOD','DG_UPDATE_SURFACE_SENSITIVITY','DG_FOCUS_SURFACE_CLASS','DG_TOGGLE_SURFACE_CANDIDATES','DG_SELECT_SURFACE_BASEMAP'])assert.ok(ui.includes(key),key);
});
