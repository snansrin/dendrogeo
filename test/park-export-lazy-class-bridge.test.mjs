import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/park-export-lazy-class-bridge.js',import.meta.url),'utf8');

test('legacy PNG class fallback resolves the lazy class catalogue at call time',()=>{
 const context={window:{},runLandCoverAnalysis(){}};
 vm.createContext(context);
 vm.runInContext('let DG_LC_CLASSES; const DG_LC_CLASSES_SAF=runLandCoverAnalysis;',context);
 vm.runInContext(source,context);
 assert.equal(context.window.DG_PARK_EXPORT_LAZY_CLASSES.install(),true);
 vm.runInContext('DG_LC_CLASSES=[{key:"green"},{key:"water"}]',context);
 assert.equal(vm.runInContext('DG_LC_CLASSES_SAF.find(item=>item.key==="water").key',context),'water');
 assert.equal(vm.runInContext('DG_LC_CLASSES_SAF.find(item=>item.key==="missing")',context),undefined);
});

test('an already loaded class array and its native find method remain untouched',()=>{
 const context={window:{}};
 vm.createContext(context);
 vm.runInContext('const DG_LC_CLASSES=[{key:"green"}]; const DG_LC_CLASSES_SAF=DG_LC_CLASSES;',context);
 vm.runInContext(source,context);
 assert.equal(vm.runInContext('DG_LC_CLASSES_SAF.find(item=>item.key==="green").key',context),'green');
 assert.equal(vm.runInContext('Object.hasOwn(DG_LC_CLASSES_SAF,"find")',context),false);
});

test('missing lazy class data returns no class and never runs analysis as a fallback',()=>{
 const context={window:{},analysisCalls:0,runLandCoverAnalysis(){this.analysisCalls++;}};
 vm.createContext(context);
 vm.runInContext('let DG_LC_CLASSES; const DG_LC_CLASSES_SAF=runLandCoverAnalysis;',context);
 vm.runInContext(source,context);
 assert.equal(vm.runInContext('DG_LC_CLASSES_SAF.find(()=>true)',context),undefined);
 assert.equal(context.analysisCalls,0);
});
