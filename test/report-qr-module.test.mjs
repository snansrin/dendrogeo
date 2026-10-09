import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQrDataUri } from '../scripts/lib/report-qr.mjs';
import { qrDataUri } from '../scripts/make-report.mjs';

test('QR adapter preserves SVG settings, encoding and non-blocking failures', async () => {
  let request;
  const render = createQrDataUri({ toString: async (url, options) => { request = { url, options }; return '<svg>✓</svg>'; } });
  const uri = await render(42);
  assert.equal(request.url, '42');
  assert.deepEqual(request.options, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 104,
    color: { dark: '#182420', light: '#ffffff' },
  });
  assert.equal(uri, 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%E2%9C%93%3C%2Fsvg%3E');
  assert.equal(await createQrDataUri(null)('https://example.test/report'), null);
  assert.equal(await createQrDataUri({ toString: async () => { throw new Error('QR unavailable'); } })('https://example.test/report'), null);
  assert.equal(typeof qrDataUri, 'function', 'make-report public API remains callable');
});
