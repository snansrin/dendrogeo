import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectJavaScript} from '../scripts/academic-audit.mjs';
test('static index preserves nested function locations and call scopes without inventing targets',()=>{
 const result=inspectJavaScript('function outer(){const inner=()=>port.run();inner();}\nouter();','sample.js');
 assert.deepEqual(result.functions.map(f=>f.name),['outer','inner']);
 assert.equal(result.functions[1].parent,result.functions[0].id);
 assert.equal(result.calls[0].callee,'port.run');
 assert.equal(result.calls[0].caller,result.functions[1].id);
 assert.ok(result.calls.every(c=>c.resolution==='unresolved-static-name'));
 assert.equal(result.calls.at(-1).caller,'sample.js:<top-level>');
});
test('computed calls remain explicitly dynamic and invalid JavaScript is rejected',()=>{
 const result=inspectJavaScript('const f=()=>object[key]();','sample.js');
 assert.equal(result.calls[0].callee,'object.[dynamic]');
 assert.throws(()=>inspectJavaScript('function {','broken.js'));
});
