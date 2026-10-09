import test from 'node:test';
import assert from 'node:assert/strict';
import { reportStyles } from '../scripts/lib/report-style.mjs';

test('report styles: print page identity is injected and HTML delimiters are escaped', () => {
  const css = reportStyles('DGR-2026-0001');
  assert.ok(css.startsWith('\n:root{'));
  assert.ok(css.includes('@bottom-left{content:"DGR-2026-0001";'));
  assert.ok(css.includes('@media print{'));
  const hostile = reportStyles('</style><script>alert(1)</script>');
  assert.ok(!hostile.includes('</style>'));
  assert.ok(hostile.includes('\\3c /style>'));
});

test('report styles: mobile table and print page layout contracts remain present', () => {
  const css = reportStyles('DGR-2026-0001');
  assert.match(css, /@media \(max-width:640px\)/);
  assert.match(css, /\.tscroll\{overflow-x:auto/);
  assert.match(css, /table\.qa\{min-width:540px\}/);
  assert.match(css, /@page\{size:A4/);
  assert.match(css, /\.fig img\{max-width:100%/);
});
