import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={};vm.runInNewContext(readFileSync(new URL('../src/ui/surface-export-color-picker.js',import.meta.url),'utf8'),{window});const {toHex,toHsl}=window.DG_SURFACE_EXPORT_COLOR_PICKER;
test('palette covers primary colors, hue wrap, black and white',()=>{
 for(const [h,s,l,hex]of [[0,100,50,'#ff0000'],[120,100,50,'#00ff00'],[240,100,50,'#0000ff'],[360,100,50,'#ff0000'],[0,0,0,'#000000'],[0,0,100,'#ffffff']])assert.equal(toHex(h,s,l),hex);
});
test('existing exact HEX colors survive palette conversion',()=>{
 for(const hex of ['#111827','#f50a0a','#14532d','#c8d8c0','#ffffff','#000000'])assert.equal(toHex(...toHsl(hex)),hex);
});
