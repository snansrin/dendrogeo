import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/parks/line-distance.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const {pointToSegmentDistanceM,pointNearImperviousLine,pointNearAnyLine}=context.window.DG_PARK_LINE_DISTANCE;

test('point-to-segment distance preserves metric projection, clamping, and degenerate segments',()=>{
  assert.equal(pointToSegmentDistanceM(39,32,[39,31],[39,33]),0);
  assert.ok(Math.abs(pointToSegmentDistanceM(39,32,[39,31],[39,31])-111320*Math.cos(39*Math.PI/180))<1e-6);
  const side=pointToSegmentDistanceM(39,32,[38.9995,31],[38.9995,33]);
  assert.ok(side>54&&side<56,`unexpected lateral distance: ${side}`);
});

test('line-nearness preserves width defaults and inclusive distance thresholds',()=>{
  const line={pts:[[39,31],[39,33]],w:56};
  assert.equal(pointNearImperviousLine(39.0005,32,[line]),true);
  assert.equal(pointNearImperviousLine(39.0005,32,[{...line,w:0}]),false);
  assert.equal(pointNearImperviousLine(39.000005,32,[{pts:line.pts,w:'invalid'}]),true);
  assert.equal(pointNearAnyLine(39.0005,32,[line.pts],56),true);
  assert.equal(pointNearAnyLine(39.0005,32,[line.pts],54),false);
  assert.equal(pointNearAnyLine(39,32,[null,[39,32]],1),false);
});
