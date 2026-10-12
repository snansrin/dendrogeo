import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReportMapClassPresentation } from '../scripts/lib/report-map-class-presentation.mjs';

test('report map classes merge pool into water for PNG presentation and keep legend order', () => {
  const water = { label: 'Su', color: '#0000ff' };
  const pool = { label: 'Havuz', color: '#00ffff' };
  const classes = {
    green: { label: 'Yeşil', color: '#00aa00' },
    hard: { label: 'Sert zemin', color: '#888888' },
    building: { label: 'Bina', color: '#aaaaaa' },
    water,
    pool,
    bare: { label: 'Çıplak', color: '#bb9977' },
    other: { label: 'Diğer', color: '#cccccc' }
  };
  const presentation = createReportMapClassPresentation({ classes, maskHa: 1.25 });

  assert.strictEqual(presentation.classFor('pool'), water);
  assert.strictEqual(presentation.classFor('water'), water);
  assert.deepEqual(presentation.rows, ['green', 'hard', 'building', 'water', 'bare', 'other', 'masked', 'border', 'point', 'outside']);
});

test('report map keeps the pool fallback and omits the mask row without masked area', () => {
  const pool = { label: 'Havuz', color: '#00ffff' };
  const presentation = createReportMapClassPresentation({ classes: { pool } });

  assert.strictEqual(presentation.classFor('pool'), pool);
  assert.equal(presentation.classFor('missing'), null);
  assert.deepEqual(presentation.rows, ['water', 'border', 'point', 'outside']);
});
