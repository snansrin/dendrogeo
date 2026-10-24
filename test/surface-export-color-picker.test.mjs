import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={};vm.runInNewContext(readFileSync(new URL('../src/ui/surface-export-color-picker.js',import.meta.url),'utf8'),{window});
test('Done leaves the original native color unchanged and moves focus without closing export',()=>{
 const calls=[];let click;const field={value:'#f50a0a',blur:()=>calls.push('blur')},done={focus:()=>calls.push('focus'),addEventListener:(_name,fn)=>click=fn};
 window.DG_SURFACE_EXPORT_COLOR_PICKER.bind({dialog:{querySelector:id=>id==='#dgExportBoundaryColor'?field:done,close:()=>assert.fail('export must remain open')}});click();assert.equal(field.value,'#f50a0a');assert.deepEqual(calls,['blur','focus']);
});
test('native palette bridge tolerates an absent export control',()=>{
 assert.doesNotThrow(()=>window.DG_SURFACE_EXPORT_COLOR_PICKER.bind({dialog:{querySelector:()=>null}}));
});
