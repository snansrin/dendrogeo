import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { REPORT_SHARE_SCRIPT } from '../scripts/lib/report-share.mjs';

async function invokeShare(overrides = {}) {
  const button = { textContent: '📤 Paylaş' };
  const calls = { share: [], copied: [], prompts: [], timers: [] };
  const context = {
    document: {
      title: 'Park raporu',
      getElementById: () => button,
      querySelector: () => ({ textContent: 'DGR-2026-0001' }),
    },
    location: { href: 'https://dendrogeo.org/rapor/DGR-2026-0001/#section' },
    navigator: {
      share: overrides.share ? async (payload) => { calls.share.push(payload); return overrides.share(payload); } : undefined,
      clipboard: { writeText: async (url) => { calls.copied.push(url); if (overrides.clipboardError) throw overrides.clipboardError; } },
    },
    window: { prompt: (...args) => calls.prompts.push(args) },
    setTimeout: (fn, ms) => calls.timers.push({ fn, ms }),
  };
  await vm.runInNewContext(REPORT_SHARE_SCRIPT + '\ndgShareReport();', context);
  return { calls, button };
}

test('report share: uses native share and strips the page fragment', async () => {
  const { calls, button } = await invokeShare({ share: async () => {} });
  assert.deepEqual(JSON.parse(JSON.stringify(calls.share)), [{
    title: 'Park raporu', text: 'Park raporu. DGR-2026-0001',
    url: 'https://dendrogeo.org/rapor/DGR-2026-0001/',
  }]);
  assert.deepEqual(calls.copied, []);
  assert.equal(button.textContent, '📤 Paylaş');
});

test('report share: native cancellation falls back to clipboard with temporary feedback', async () => {
  const { calls, button } = await invokeShare({ share: async () => { throw new Error('cancelled'); } });
  assert.deepEqual(calls.copied, ['https://dendrogeo.org/rapor/DGR-2026-0001/']);
  assert.equal(button.textContent, '✅ Bağlantı kopyalandı');
  assert.equal(calls.timers[0].ms, 2400);
  calls.timers[0].fn();
  assert.equal(button.textContent, '📤 Paylaş');
});

test('report share: clipboard failure opens the manual copy prompt', async () => {
  const { calls } = await invokeShare({ clipboardError: new Error('clipboard unavailable') });
  assert.deepEqual(calls.prompts, [[
    'Bağlantıyı kopyalayın (Ctrl+C):', 'https://dendrogeo.org/rapor/DGR-2026-0001/',
  ]]);
});
