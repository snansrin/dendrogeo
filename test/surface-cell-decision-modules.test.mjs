import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/build-cell-decision-popup-model.js','src/ui/render-cell-decision-popup.js','src/application/surface/apply-surface-cell-decision.js','src/application/surface/undo-surface-cell-decision.js','src/application/surface/reset-surface-corrections.js'];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('popup model retains area, current class, five choices and undo presence',()=>{
  const window=setup(),cell={areaM2:12.34},meta=key=>({emoji:key==='water'?'💧':'🌳',tr:key});
  const model=window.DG_SURFACE_CELL_DECISION_POPUP_MODEL.build({cell,key:'2:7',currentClass:'water',decision:{to:'water'},meta});assert.equal(model.areaM2,12.34);assert.equal(model.options.length,5);assert.equal(model.options[3].classKey,'water');assert.equal(model.options[3].selected,true);assert.equal(model.canUndo,true);assert.ok(!model.options.some(option=>option.classKey==='pool'));
});

test('popup view keeps the legacy class order, handlers and escaped text',()=>{
  const window=setup(),model=window.DG_SURFACE_CELL_DECISION_POPUP_MODEL.build({cell:{areaM2:12.34},key:'2:7',currentClass:'water',decision:{},meta:key=>({emoji:'•',tr:`<${key}>`})}),html=window.DG_SURFACE_CELL_DECISION_POPUP_VIEW.render({model,escape:value=>value.replaceAll('<','&lt;').replaceAll('>','&gt;'),translate:value=>value});
  assert.match(html,/12\.3 m²/);assert.match(html,/onclick="dgSensDecide\('2:7','green'\)"/);assert.match(html,/onclick="dgSensUndo\('2:7'\)"/);assert.ok(html.indexOf("'green'")<html.indexOf("'hard'")&&html.indexOf("'hard'")<html.indexOf("'building'")&&html.indexOf("'building'")<html.indexOf("'water'")&&html.indexOf("'water'")<html.indexOf("'bare'"));assert.doesNotMatch(html,/pool|Havuz/);assert.match(html,/&lt;water&gt;/);
});

test('single decision validates before preserving the dirty/close/refresh/save order',()=>{
  const window=setup(),events=[],cell={row:1},apply=window.DG_APPLY_SURFACE_CELL_DECISION.apply,ports={rawView:false,cell,types:{water:{}},toClass:'water',busy:false,saving:false,createDecision:()=>{events.push('decision');return{key:'1:0'};},dirty:()=>events.push('dirty'),closePopup:()=>events.push('close'),refresh:()=>events.push('refresh'),summary:()=>events.push('summary'),status:()=>events.push('status'),save:()=>events.push('save')};
  assert.equal(apply(ports),true);assert.deepEqual(events,['decision','dirty','close','refresh','summary','status','save']);events.length=0;assert.equal(apply({...ports,toClass:'bad'}),false);assert.deepEqual(events,[]);
});

test('bulk correction keeps candidate order and calls the same single-cell entry',()=>{
  const window=setup(),events=[];window.DG_APPLY_SURFACE_CELL_DECISION.bulk({candidates:[{cell:{id:'a'}},{cell:{id:'b'}}],classKey:'water',cellKey:cell=>cell.id,apply:(key,value)=>events.push([key,value])});assert.deepEqual(JSON.parse(JSON.stringify(events)),[['a','water'],['b','water']]);
});

test('undo and reset preserve ownership gates, confirmation, and state clear order',()=>{
  const window=setup(),events=[],record={corrections:{a:{}},features:[{}],brushHistory:[{}]};
  assert.equal(window.DG_UNDO_SURFACE_CELL_DECISION.undo({rawView:false,record,key:'a',busy:false,saving:false,dirty:()=>events.push('dirty'),closePopup:()=>events.push('close'),refresh:()=>events.push('refresh'),summary:()=>events.push('summary'),save:()=>events.push('save')}),true);assert.deepEqual(events,['dirty','close','refresh','summary','save']);assert.equal('a' in record.corrections,false);
  events.length=0;window.DG_RESET_SURFACE_CORRECTIONS.reset({rawView:false,busy:false,saving:false,confirmReset:()=>false,record,dirty:()=>events.push('dirty'),repartition:()=>events.push('partition'),save:()=>events.push('save')});assert.deepEqual(events,[]);
  window.DG_RESET_SURFACE_CORRECTIONS.reset({rawView:false,busy:false,saving:false,confirmReset:()=>true,record,dirty:()=>events.push('dirty'),repartition:()=>Promise.resolve(true),save:()=>events.push('save')});assert.equal(JSON.stringify(record.corrections),'{}');assert.equal(JSON.stringify(record.features),'[]');assert.equal(JSON.stringify(record.brushHistory),'[]');assert.equal(events[0],'dirty');
});

test('five decision modules load and are precached before the locked surface UI',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}
  for(const name of ['DG_SURFACE_CELL_DECISION_POPUP_MODEL','DG_SURFACE_CELL_DECISION_POPUP_VIEW','DG_APPLY_SURFACE_CELL_DECISION','DG_UNDO_SURFACE_CELL_DECISION','DG_RESET_SURFACE_CORRECTIONS'])assert.ok(ui.includes(name));
});
