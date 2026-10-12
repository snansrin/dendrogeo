import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadOptionalReportQr } from '../scripts/lib/report-qr-loader.mjs';

test('optional report QR loader resolves only the existing qrcode package', () => {
  const calls = [];
  const library = { toString() {} };
  assert.equal(loadOptionalReportQr(name => {
    calls.push(name);
    return library;
  }), library);
  assert.deepEqual(calls, ['qrcode']);
});

test('optional report QR loader falls back to null when the package is unavailable', () => {
  assert.equal(loadOptionalReportQr(() => { throw new Error('module not found'); }), null);
});
