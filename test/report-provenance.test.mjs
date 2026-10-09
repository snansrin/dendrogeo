import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportProvenance } from '../scripts/lib/report-provenance.mjs';

test('report provenance preserves the existing raster snapshot contract', () => {
  const provenance = buildReportProvenance({
    engineVersion: '4.2.0',
    appVersion: '3.0.0',
    gitCommit: 'report-commit',
    fallbackGitCommit: 'build-commit',
    reportId: 'DGR-2026-0001',
    measurementProtocol: 'rho-lock-v1',
    measurementProtocolFingerprint: 'sha256:rho',
    lulc: { epsg: 32636, source: 'Test raster' },
    savedSurface: null,
    datasetDefault: 'ESA WorldCover 10 m · 2021 (v200)',
  });

  assert.deepEqual(provenance, {
    engine: 'DendroGeo LC Engine',
    engine_version: '4.2.0',
    app_version: '3.0.0',
    git_commit: 'report-commit',
    report_id: 'DGR-2026-0001',
    report_standard: 'DendroGeo Academic Report 3.0',
    publication_stage: 'production',
    measurement_protocol: 'rho-lock-v1',
    measurement_protocol_fingerprint: 'sha256:rho',
    epsg: 32636,
    resolution_m: 10,
    resolution_note: '10 m',
    dataset: 'Test raster',
  });
});

test('surface snapshot and missing metadata keep prior null/default behavior', () => {
  const provenance = buildReportProvenance({
    engineVersion: null,
    appVersion: null,
    gitCommit: '',
    fallbackGitCommit: null,
    reportId: '',
    measurementProtocol: 'rho-lock-v1',
    measurementProtocolFingerprint: 'sha256:rho',
    lulc: { epsg: 0, source: '' },
    savedSurface: { acceptedAt: '2026-10-01T00:00:00.000Z' },
    datasetDefault: 'ESA WorldCover 10 m · 2021 (v200)',
  });

  assert.deepEqual(provenance, {
    engine: 'DendroGeo LC Engine',
    engine_version: null,
    app_version: null,
    git_commit: null,
    report_id: null,
    report_standard: 'DendroGeo Academic Report 3.0',
    publication_stage: 'production',
    measurement_protocol: 'rho-lock-v1',
    measurement_protocol_fingerprint: 'sha256:rho',
    epsg: null,
    resolution_m: null,
    resolution_note: 'Uydu 10/20 m; OSM ve çizim vektör sınırları',
    dataset: 'ESA WorldCover 10 m · 2021 (v200)',
  });
});

test('build-time commit is the fallback when the publication request has no commit', () => {
  const provenance = buildReportProvenance({
    engineVersion: '4.2.0',
    appVersion: '3.0.0',
    gitCommit: null,
    fallbackGitCommit: 'build-commit',
    reportId: null,
    measurementProtocol: 'rho-lock-v1',
    measurementProtocolFingerprint: 'sha256:rho',
    lulc: null,
    savedSurface: null,
    datasetDefault: 'ESA WorldCover 10 m · 2021 (v200)',
  });

  assert.equal(provenance.git_commit, 'build-commit');
  assert.equal(provenance.report_id, null);
});
