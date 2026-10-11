import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/gis-export-events.js',import.meta.url),'utf8');
function setup({vegetationView=true,rawView=false}={}){
 const listeners=[],calls=[];
 const window={DG_LC_SENS:{state:{vegetationView,rawView}}};
 const document={addEventListener:(...args)=>listeners.push(args)};
 const context=vm.createContext({window});
 vm.runInContext(source,context);
 const result=window.DG_GIS_EXPORT_EVENTS.bind({document,window,
  exportMap:()=>calls.push(['map']),exportVerified:layers=>calls.push(['verified',layers])});
 return {listeners,calls,result};
}
function click(listener,target){
 const calls=[];
 listener({target,preventDefault:()=>calls.push('prevent'),stopImmediatePropagation:()=>calls.push('stop')});
 return calls;
}

test('verified export dialog is captured and forwards current layer choices',()=>{
 const {listeners,calls,result}=setup();
 assert.equal(result,true);assert.equal(listeners.length,1);assert.equal(listeners[0][0],'click');assert.equal(listeners[0][2],true);
 const choices={park:true,surface:true,grid:false,waypoints:true},dialog={id:'dgSurfaceExportDialog',
  querySelector:q=>({checked:choices[q.match(/\[name="([^"]+)"\]/)[1]]}),close:()=>calls.push(['close'])};
 const action={closest:q=>q==='dialog'?dialog:null};
 const target={closest:q=>q==='#dgExportDownload'?action:null};
 assert.deepEqual(click(listeners[0][1],target),['prevent','stop']);
 assert.equal(calls[0][0],'close');
 assert.equal(calls[1][0],'verified');
 assert.deepEqual({...calls[1][1]},choices);
});

test('plain PNG button is captured while unrelated and dialog-opener clicks pass through',()=>{
 const {listeners,calls}=setup({vegetationView:false});
 const plain={closest:q=>q==='button[onclick*="downloadParkImage"]'?{}:null};
 assert.deepEqual(click(listeners[0][1],plain),['prevent','stop']);
 assert.deepEqual(calls,[['map']]);
 const unrelated={closest:()=>null};
 assert.deepEqual(click(listeners[0][1],unrelated),[]);
 assert.deepEqual(calls,[['map']]);
});

test('bridge does not bind when document has no event API',()=>{
 const {window}=vm.createContext({window:{}});
 vm.runInContext(source,vm.createContext({window}));
 assert.equal(window.DG_GIS_EXPORT_EVENTS.bind({document:{},window,exportMap(){},exportVerified(){}}),false);
});
