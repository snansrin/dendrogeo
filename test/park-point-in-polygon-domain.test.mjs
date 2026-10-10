import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/parks/point-in-polygon.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const {projectPoint,pointInPolygonXY,pointInPolygon}=context.window.DG_PARK_POINT_IN_POLYGON;

test('local projection retains legacy meters-per-degree and latitude scaling',()=>{
  const equator=projectPoint(0,1,0);
  const higherLatitude=projectPoint(60,1,60);
  assert.equal(equator.x,111320);
  assert.equal(equator.y,0);
  assert.ok(higherLatitude.x<equator.x);
  assert.equal(projectPoint(40,31,40).x,31*111320*Math.cos(40*Math.PI/180));
});

test('point-in-ring preserves ray casting behavior and legacy [LAT,LON] coordinates',()=>{
  const ring=[[39,32],[39,33],[40,33],[40,32]];
  assert.equal(pointInPolygon(39.5,32.5,ring),true);
  assert.equal(pointInPolygon(41.5,32.5,ring),false);
  assert.equal(pointInPolygon(39.5,34.5,ring),false);
  assert.equal(pointInPolygon(39.5,32.5,null),false);
  assert.equal(pointInPolygon(39.5,32.5,[[39,32],[39,33]]),false);
  const concave=[{x:0,y:0},{x:3,y:0},{x:3,y:1},{x:1,y:1},{x:1,y:3},{x:0,y:3}];
  assert.equal(pointInPolygonXY(0.5,0.5,concave),true);
  assert.equal(pointInPolygonXY(2.5,2.5,concave),false);
});
