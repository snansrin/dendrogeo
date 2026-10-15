import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PngCanvas } from '../scripts/lib/png.mjs';
import { fillSurfacePolygon } from '../scripts/lib/report-map-surface-fill.mjs';

test('surface polygon rasterization fills the outer ring and leaves holes untouched', () => {
  const background = [0, 0, 0];
  const fill = [200, 30, 40];
  const canvas = new PngCanvas(8, 8, background);
  const outer = [[1, 1], [6, 1], [6, 6], [1, 6], [1, 1]];
  const hole = [[2, 2], [5, 2], [5, 5], [2, 5], [2, 2]];

  fillSurfacePolygon(canvas, [outer, hole], fill);

  const pixel = (x, y) => Array.from(canvas.px.slice((y * canvas.w + x) * 4, (y * canvas.w + x) * 4 + 3));
  assert.deepEqual(pixel(1, 1), fill);
  assert.deepEqual(pixel(1, 5), fill);
  assert.deepEqual(pixel(3, 3), background);
  assert.deepEqual(pixel(0, 3), background);
});

test('adjacent vegetation cannot paint over a narrow road at fractional polygon edges', () => {
  const road=[100,116,139],green=[34,197,94];
  const box=(left,right)=>[[left,0],[right,0],[right,4],[left,4],[left,0]];
  for(const greens of [[box(0,2.2),box(2.8,5)],[box(2.8,5),box(0,2.2)]]){
    const canvas=new PngCanvas(5,4,road);
    for(const ring of greens)fillSurfacePolygon(canvas,[ring],green);
    for(let y=0;y<4;y++){
      const pixel=x=>Array.from(canvas.px.slice((y*canvas.w+x)*4,(y*canvas.w+x)*4+3));
      assert.deepEqual(pixel(2),road,'road pixel centre must remain visible');
      assert.deepEqual(pixel(1),green);
      assert.deepEqual(pixel(3),green);
    }
  }
});
