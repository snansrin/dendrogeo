import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../src/ui/choose-new-park-controller.js',import.meta.url),'utf8'),c);
function setup({busy=false,save=null,mode=false}={}){const events=[];const run=c.window.DG_CHOOSE_NEW_PARK_CONTROLLER_UI.create({isBusy:()=>busy,getSave:()=>{events.push('getSave');return save;},clearPark:()=>events.push('park'),clearGrid:()=>events.push('grid'),clearAnalysis:()=>events.push('analysis'),hideInfo:()=>events.push('hide'),getMode:()=>mode,toggleMode:()=>events.push('toggle'),bindClick:()=>events.push('bind'),resizeMap:()=>events.push('resize'),scrollMap:()=>events.push('scroll'),notify:()=>events.push('notify')});return{run,events};}
test('busy state prevents saving, clearing and navigation',async()=>{const x=setup({busy:true});await x.run();assert.deepEqual(x.events,[]);});
test('pending save must finish before any clearing or navigation',async()=>{let release;const x=setup({save:()=>new Promise(r=>release=r)});const run=x.run();assert.deepEqual(x.events,['getSave']);release();await run;assert.deepEqual(x.events,['getSave','park','grid','analysis','hide','toggle','resize','scroll','notify']);});
test('failed save propagates without removing current park or analysis',async()=>{const x=setup({save:async()=>{throw Error('save failed');}});await assert.rejects(x.run(),/save failed/);assert.deepEqual(x.events,['getSave']);});
test('active mode binds click and no-save path clears synchronously before returning',async()=>{const x=setup({mode:true});const run=x.run();assert.deepEqual(x.events,['getSave','park','grid','analysis','hide','bind','resize','scroll','notify']);await run;});
