import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
 'src/adapters/surface/surface-right-pan-session.js',
 'src/ui/select-surface-draw-type.js',
 'src/application/surface/select-surface-brush-type.js',
 'src/application/surface/return-surface-to-hand-mode.js',
 'src/ui/update-surface-opacity.js'
];
function setup(){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('right pan captures right-button drags, ignores other pointers, and unbinds all handlers',()=>{
 const api=setup().DG_SURFACE_RIGHT_PAN_SESSION,listeners=new Map(),removed=[],captures=[],released=[],pans=[];
 const container={style:{},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn,capture)=>removed.push([name,fn,capture]),setPointerCapture:id=>captures.push(id),releasePointerCapture:id=>released.push(id)};
 const state={rightPan:null,brush:null},map={getContainer:()=>container,panBy:(delta,options)=>pans.push([delta,options])};
 api.bind({state,map,unbind:()=>api.unbind({state})});const event=(values={})=>({button:2,isPrimary:true,pointerId:7,clientX:10,clientY:20,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...values});
 listeners.get('pointerdown')(event());listeners.get('pointermove')(event({clientX:14,clientY:17}));listeners.get('pointerup')(event({clientX:14,clientY:17}));
 assert.deepEqual(captures,[7]);assert.equal(pans.length,1);assert.equal(pans[0][0][0],-4);assert.equal(pans[0][0][1],3);assert.equal(pans[0][1].animate,false);assert.deepEqual(released,[7]);assert.equal(container.style.cursor,'');
 const menuEvent=event();listeners.get('contextmenu')(menuEvent);assert.equal(menuEvent.prevented,true);assert.equal(menuEvent.stopped,true);
 api.unbind({state});assert.equal(removed.length,5);assert.ok(removed.every(x=>x[2]===true));assert.equal(state.rightPan,null);
});

test('draw and brush selection preserve supported-type and editing gates',()=>{
 const w=setup(),types={water:{},green:{}},buttonStates=new Map(),pressed=new Map(),select={value:''},styles=[];
 const buttons=['water','green'].map(type=>({dataset:{surfaceType:type},classList:{toggle:(name,on)=>buttonStates.set(type,on)},setAttribute:(name,value)=>pressed.set(type,value)}));
 const document={getElementById:()=>select},querySelectorAll=()=>buttons,state={drawType:'building',objectPreviewLayer:{setStyle:value=>styles.push(value)}};
 assert.equal(w.DG_SELECT_SURFACE_DRAW_TYPE.select({state,type:'water',types,colors:{water:'#00f',other:'#aaa'},document,querySelectorAll}),true);
 assert.equal(state.drawType,'water');assert.equal(styles[0].color,'#00f');assert.equal(select.value,'water');assert.equal(pressed.get('water'),'true');assert.equal(pressed.get('green'),'false');
 assert.equal(w.DG_SELECT_SURFACE_DRAW_TYPE.select({state,type:'unknown',types,colors:{},document,querySelectorAll}),false);
 let stopped=0,toggled=0,rendered=0;const callbacks={stop:()=>stopped++,toggle:()=>toggled++,render:()=>rendered++};
 assert.equal(w.DG_SELECT_SURFACE_BRUSH_TYPE.select({state:{rawView:true,busy:false,saving:false},type:'water',types,...callbacks}),false);
 const active={brush:{}};assert.equal(w.DG_SELECT_SURFACE_BRUSH_TYPE.select({state:active,type:'water',types,...callbacks}),true);assert.equal(active.brushType,'water');assert.equal(stopped,1);assert.equal(toggled,1);assert.equal(rendered,0);
 const inactive={brush:null};assert.equal(w.DG_SELECT_SURFACE_BRUSH_TYPE.select({state:inactive,type:'green',types,...callbacks}),true);assert.equal(inactive.brushType,'green');assert.equal(toggled,2);assert.equal(stopped,1);
});

test('hand mode closes brush/drawing before rendering',()=>{
 const api=setup().DG_RETURN_SURFACE_TO_HAND_MODE,events=[],state={draw:{ring:[]}};
 api.run({state,stopBrush:()=>events.push('stop'),cancelDraw:()=>events.push('cancel'),render:()=>events.push('render')});assert.deepEqual(events,['stop','cancel','render']);
 events.length=0;api.run({state:{draw:null},stopBrush:()=>events.push('stop'),cancelDraw:()=>events.push('cancel'),render:()=>events.push('render')});assert.deepEqual(events,['stop','render']);
});

test('opacity remains clamped, debounced, and reflected in every display path',()=>{
 const api=setup().DG_UPDATE_SURFACE_OPACITY,scheduled=[],cleared=[],fills=[],output={textContent:''},state={opacity:45,saveTimer:123,record:{},displayPaths:[{poly:{setStyle:value=>fills.push(value)}},{poly:{setStyle:value=>fills.push(value)}}]};
 const result=api.update({state,value:'135',document:{getElementById:()=>output},clearTimer:value=>cleared.push(value),setTimer:(fn,delay)=>(scheduled.push([fn,delay]),456),save:()=>{}});
 assert.equal(result,100);assert.equal(state.record.displayOpacity,100);assert.deepEqual(cleared,[123]);assert.equal(scheduled[0][1],900);assert.equal(output.textContent,'%100');assert.equal(fills.length,2);assert.ok(fills.every(value=>value.fillOpacity===1));
});

test('five interaction modules load before locked UI, are precached, and have service delegations',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');
 for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} precedes UI`);}
 for(const key of ['DG_SURFACE_RIGHT_PAN_SESSION','DG_SELECT_SURFACE_DRAW_TYPE','DG_SELECT_SURFACE_BRUSH_TYPE','DG_RETURN_SURFACE_TO_HAND_MODE','DG_UPDATE_SURFACE_OPACITY'])assert.ok(ui.includes(key),key);
});
