import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp } from '../scripts/test-harness.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const serviceOnly = loadApp({ sadece: ['src/services/lc-validate.js'] }).DG_LC_VALIDATE;
const modular = loadApp({ sadece: [
  'src/domain/surface/validation-sampling.js',
  'src/domain/surface/validation-accuracy-metrics.js',
  'src/domain/surface/validation-spectral-rules.js',
  'src/application/surface/build-validation-agreement.js',
  'src/application/surface/serialize-validation-campaign.js',
  'src/services/lc-validate.js',
] }).DG_LC_VALIDATE;
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

test('lc-validate module path preserves sampling, metrics, spectral, agreement and exports', () => {
  const cells = ['green', 'water', 'hard', 'bare'].flatMap((classKey, index) =>
    Array.from({ length: 4 }, (_, n) => ({
      classKey, classCode: index + 1, row: index, col: n, areaM2: 900,
      center: { lat: 41 + index / 100, lon: 29 + n / 100 },
      quadWgs: [[29, 41], [29.01, 41], [29.01, 41.01], [29, 41.01]],
    })));
  const sampleOptions = { seed: 42, perStratum: 3 };
  assert.equal(modular.rng(99)(), serviceOnly.rng(99)());
  same(modular.stratifiedSample(cells, sampleOptions), serviceOnly.stratifiedSample(cells, sampleOptions));
  same(modular.spatialSample(cells, { seed: 21, count: 7 }), serviceOnly.spatialSample(cells, { seed: 21, count: 7 }));

  const labels = [{ mapClass: 'green', refClass: 'green' }, { mapClass: 'green', refClass: 'water' },
    { mapClass: 'water', refClass: 'water' }, { mapClass: 'hard', refClass: 'ambiguous' }];
  const confusion = modular.confusion(labels);
  same(confusion, serviceOnly.confusion(labels));
  const weights = modular.weights({ green: 60, water: 30, hard: 10 }, 100);
  same(modular.metrics(confusion, weights, 10000), serviceOnly.metrics(confusion, weights, 10000));

  const spectra = { obs: 4, ndvi: 0.12, mndwi: -0.1, ndbi: 0.2, ndviMax: 0.2, mndwiMax: 0.1 };
  same(modular.thresholds({ green: 80, water: 20, hard: 60, bare: 50 }), serviceOnly.thresholds({ green: 80, water: 20, hard: 60, bare: 50 }));
  assert.equal(modular.spectralPredict(spectra), serviceOnly.spectralPredict(spectra));
  const byCell = { '0:0': spectra, '1:0': { obs: 4, ndvi: 0, mndwi: 0.7, ndbi: 0 } };
  same(modular.agreement(cells, byCell), serviceOnly.agreement(cells, byCell));

  const campaign = { id: 'c1', parkName: 'Park', parkId: 'p1', seed: 42, createdAt: '2026-10-13', samples: modular.stratifiedSample(cells, sampleOptions), metrics: { ...modular.metrics(confusion, weights, 10000), oaCi95: 0.1 }, gate: { state: 'INCELEME', label: '🟡 İNCELEME', reasons: ['test'] }, corrections: { '0:0': { from: 'green', to: 'water', ts: 'now' } }, rasterAreas: { green: 900, water: 0, hard: 0, bare: 0 } };
  assert.equal(modular.csv(campaign), serviceOnly.csv(campaign));
  assert.equal(modular.json(campaign), serviceOnly.json(campaign));
  const correctionArgs = [campaign.rasterAreas, cells, campaign.corrections];
  same(modular.applyCorrections(...correctionArgs), serviceOnly.applyCorrections(...correctionArgs));
  const spectralCells = { '0:0': spectra };
  same(modular.correctedGeoJson(cells, campaign.corrections, spectralCells), serviceOnly.correctedGeoJson(cells, campaign.corrections, spectralCells));
});

test('validation modules load before the service and are available offline', () => {
  const chain = read('src/utils/lazylibs.js');
  const worker = read('sw.js');
  const modules = [
    'src/domain/surface/validation-sampling.js',
    'src/domain/surface/validation-accuracy-metrics.js',
    'src/domain/surface/validation-spectral-rules.js',
    'src/application/surface/build-validation-agreement.js',
    'src/application/surface/serialize-validation-campaign.js',
  ];
  const serviceIndex = chain.indexOf('"src/services/lc-validate.js"');
  for (const modulePath of modules) {
    assert.ok(chain.indexOf('"' + modulePath + '"') >= 0 && chain.indexOf('"' + modulePath + '"') < serviceIndex, modulePath + ' must load before service');
    assert.ok(worker.includes("'/" + modulePath + "'"), modulePath + ' must be in service-worker precache');
  }
});
