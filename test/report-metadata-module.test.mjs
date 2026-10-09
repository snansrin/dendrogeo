import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReportMetadata } from '../scripts/lib/report-metadata.mjs';

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/report-snapshot.json', import.meta.url)));
const policy = {
  datasetDefault: 'ESA WorldCover 10 m · 2021 (v200)',
  siteOrigin: 'https://example.test',
  reportTitle: 'DGR — DendroGeo Bilimsel Analiz Raporu',
  epsgLabel: (epsg) => epsg == null ? 'Belirtilmedi' : `EPSG:${epsg}`,
  trNum: (value, digits = 2) => Number(value).toFixed(digits).replace('.', ','),
  legalStatusScope: 'Bu rapor yasal statü değerlendirmesi içermez.',
  qaLimits: { CARBON_DEV_PCT: 20, CARBON_DEV_MIN_KG: 5 },
  qaState: { VALID: 'VALID', REVIEW: 'REVIEW', BLOCKED: 'BLOCKED' },
};

test('metadata modülü açık bağımlılıklarla makine-okur sözleşmeyi kurar ve girdiyi değiştirmez', () => {
  const before = JSON.stringify(snapshot);
  const metadata = createReportMetadata(snapshot, {
    id: 'DGR-2026-9001',
    hash: 'a'.repeat(64),
    version: '1.0',
    history: [],
  }, policy);

  assert.equal(metadata.schema, 'dendrogeo-report-metadata/1');
  assert.equal(metadata.identifier, 'DGR-2026-9001');
  assert.equal(metadata.identifierDescription, policy.reportTitle + ' (iç/alan kimliği)');
  assert.equal(metadata.resultHash, 'sha256:' + 'a'.repeat(64));
  assert.equal(metadata.url, 'https://example.test/rapor/DGR-2026-9001/');
  assert.equal(metadata.scopeNote, policy.legalStatusScope);
  assert.equal(metadata.resourceTypeGeneral, 'Report');
  assert.equal(JSON.stringify(snapshot), before);
});

test('invalid DOI stays absent while valid DOI becomes the report identifier relation', () => {
  const invalid = createReportMetadata(snapshot, {
    id: 'DGR-2026-9001', hash: 'b'.repeat(64), meta: { doi: 'javascript:alert(1)' }, history: [],
  }, policy);
  assert.equal(invalid.doi, null);
  assert.ok(!invalid.relatedIdentifiers.some((item) => item.relationType === 'IsIdenticalTo'));

  const validDoi = '10.5281/zenodo.123456789';
  const valid = createReportMetadata(snapshot, {
    id: 'DGR-2026-9001', hash: 'b'.repeat(64), meta: { doi: validDoi }, history: [],
  }, policy);
  assert.equal(valid.doi, validDoi);
  assert.ok(valid.relatedIdentifiers.some((item) => item.relationType === 'IsIdenticalTo' && item.relatedIdentifier === validDoi));
});
