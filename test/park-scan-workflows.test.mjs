import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/application/parks/start-park-scan.js',
 'src/application/parks/focus-park-scan-target.js',
 'src/domain/parks/select-park-scan-step.js',
 'src/ui/preview-park-project-name.js',
 'src/application/parks/cancel-park-scan.js'
];
function load(){const window={},context=vm.createContext({window});for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);return window;}

test('start park scan preserves map handoff, delayed focus, card scroll and notice order',()=>{
 const api=load().DG_START_PARK_SCAN,events=[],card={scrollIntoView:options=>events.push(['scroll',options])},map={invalidateSize:()=>events.push('invalidate')};let timer;
 api.start({projectId:7},{setActive:value=>events.push(['active',value]),setTargetProject:value=>events.push(['target',value]),setReturnTo:value=>events.push(['return',value]),go:value=>events.push(['go',value]),parkMode:()=>false,toggleParkMode:()=>events.push('toggle'),schedule:(fn,delay)=>{timer=fn;events.push(['schedule',delay]);},map:()=>map,focusTarget:()=>events.push('focus'),render:()=>events.push('render'),card:()=>card,notify:(...args)=>events.push(['notify',...args])});
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['active',true],['target',7],['return','measure'],['go','map'],'toggle',['schedule',200],['notify','🌳 Park algılama: haritada parkın içine tıkla','info','🌳']]);
 timer();assert.deepEqual(JSON.parse(JSON.stringify(events.slice(-4))),['invalidate','focus','render',['scroll',{behavior:'smooth',block:'start'}]]);
});

test('focus scan target prefers valid project measurements and falls back to GPS',async()=>{
 const api=load().DG_FOCUS_PARK_SCAN_TARGET,events=[],map={fitBounds:(...args)=>events.push(['fit',...args]),setView:(...args)=>events.push(['gps',...args])};
 await api.focus(7,{map:()=>map,readProjectMeasurements:async id=>({data:[{lat:'39',lon:'32'},{lat:null,lon:2}]}),bounds:points=>({points,pad:value=>({points,pad:value})}),gps:()=>({latitude:40,longitude:29})});
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['fit',{points:[[39,32],[0,2]],pad:.4},{maxZoom:17}]]);
 await api.focus(null,{map:()=>map,readProjectMeasurements:async()=>({data:[]}),bounds:points=>({pad:()=>points}),gps:()=>({latitude:40,longitude:29})});
 assert.deepEqual(JSON.parse(JSON.stringify(events.at(-1))),['gps',[40,29],17]);
});

test('scan step, project-name preview, and cancel preserve existing state rules',()=>{
 const w=load();assert.equal(w.DG_SELECT_PARK_SCAN_STEP.select(null,null),1);assert.equal(w.DG_SELECT_PARK_SCAN_STEP.select(null,{name:'Candidate'}),2);assert.equal(w.DG_SELECT_PARK_SCAN_STEP.select({id:1},null),3);
 const preview={textContent:''};assert.equal(w.DG_PREVIEW_PARK_PROJECT_NAME.update(preview,{value:'Field'},{name:'Park'},null,(park,label)=>park+' - '+label),true);assert.equal(preview.textContent,'Park - Field');assert.equal(w.DG_PREVIEW_PARK_PROJECT_NAME.update(null,{},null,null,()=>''),false);
 const events=[];assert.equal(w.DG_CANCEL_PARK_SCAN.cancel({setActive:value=>events.push(['active',value]),setTargetProject:value=>events.push(['target',value]),returnTo:()=> 'measure',setReturnTo:value=>events.push(['return',value]),render:()=>events.push('render'),go:value=>events.push(['go',value])}),'measure');assert.deepEqual(events,[['active',false],['target',null],['return',null],'render',['go','measure']]);
});
