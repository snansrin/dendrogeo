import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../src/ui/park-candidate-select.js',import.meta.url),'utf8'),c);const render=c.window.DG_PARK_CANDIDATE_SELECT_UI.render;
test('selector keeps candidate order, selected identity, escaping and one-decimal hectare output',()=>{const selected={name:'B & C',area:12345},other={name:'<A>',area:9876},html=render({candidates:[other,selected],selected,escape:s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),formatArea:n=>n.toFixed(1)});assert.match(html,/id="parkAlt" onchange="switchPark\(\+this\.value\)"/);assert.ok(html.indexOf('&lt;A&gt;')<html.indexOf('B &amp; C'));assert.match(html,/<option value="0">&lt;A&gt; · 1\.0 ha<\/option>/);assert.match(html,/<option value="1" selected>B &amp; C · 1\.2 ha<\/option>/);assert.equal((html.match(/<option/g)||[]).length,2);});
test('zero or one candidate has no alternate selector',()=>{assert.equal(render({candidates:[],selected:null,escape:String,formatArea:String}), '');assert.equal(render({candidates:[{name:'A'}],selected:null,escape:String,formatArea:String}), '');});
test('HTML escaping is delegated for fallback labels and callback format stays explicit',()=>{const calls=[],html=render({candidates:[{name:'A',area:10000},{area:10000}],selected:null,escape:s=>'safe:'+s,formatArea:n=>{calls.push(n);return'1,0';}});assert.match(html,/safe:Alan 2 · 1,0 ha/);assert.deepEqual(calls,[1,1]);});
