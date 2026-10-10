import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/ui/grid-build-completion.js',import.meta.url),'utf8'),context);
const complete=context.window.DG_GRID_BUILD_COMPLETION_UI.complete;
function setup(result,review){const cells=[{id:'old'}],events=[];let meta;const signature={epoch:3};return{cells,events,run:()=>complete({outcome:{result,signature,review},clearance:5,clear:()=>{events.push('clear');cells.length=0;},setSource:s=>{assert.equal(s,signature);events.push('source');},setMeta:s=>{meta=s;events.push('meta');},cells,render:()=>events.push('render'),translate:s=>s,translateFormat:(s,v)=>s.replace('{n}',v.n),notify:(...args)=>events.push(args)}),meta:()=>meta};}
test('accepted cells replace previous cells before rendering and notify after render',()=>{const cell={id:'new'};const x=setup({cells:[cell],areaM2:12345},{editing:true});x.run();assert.equal(x.cells[0],cell);assert.equal(x.cells.length,1);assert.deepEqual(x.events,['clear','source','meta','render',['✓ Grid hazır: 1 hücre','ok','🔲']]);assert.equal(x.meta(),'<p class="measure-help">Su ve sert zeminden uzaklık: 5 m · Yüzey önizlemesi · 1.234 ha uygun alan</p>');});
test('empty accepted grid retains stored-surface label and warns with zero cells',()=>{const x=setup({cells:[],areaM2:0});x.run();assert.equal(x.cells.length,0);assert.match(x.meta(),/Kayıtlı yüzey · 0.000 ha/);assert.deepEqual(x.events.at(-1),['✓ Grid hazır: 0 hücre','warn','🔲']);});
test('render failure propagates to controller without a success notification',()=>{const events=[];assert.throws(()=>complete({outcome:{result:{cells:[],areaM2:10000}},clearance:0,clear:()=>{},setSource:()=>{},setMeta:()=>{},cells:[],render:()=>{throw Error('draw failed');},translate:s=>s,translateFormat:()=>'',notify:()=>events.push('notify')}),/draw failed/);assert.deepEqual(events,[]);});
