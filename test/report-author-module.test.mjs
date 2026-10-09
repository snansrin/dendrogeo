import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReportAuthor } from '../scripts/lib/report-author.mjs';

test('report author: data owner wins and request author is not queried', async () => {
  const calls = [];
  const rest = async (table) => {
    calls.push(table);
    if (table === 'rpc/dg_park_author') return [{ full_name: '  Veri Sahibi  ' }];
    throw new Error('lower priority source must not run');
  };

  assert.deepEqual(await resolveReportAuthor(25, rest), {
    name: 'Veri Sahibi', full_name: 'Veri Sahibi', source: 'data_owner',
  });
  assert.deepEqual(calls, ['rpc/dg_park_author']);
});

test('report author: absent data owner falls back to the latest report request', async () => {
  const calls = [];
  const rest = async (table, params) => {
    calls.push([table, params]);
    return table === 'rpc/dg_park_author' ? [] : [{ full_name: 'İstek Sahibi' }];
  };

  assert.deepEqual(await resolveReportAuthor(25, rest), {
    name: 'İstek Sahibi', full_name: 'İstek Sahibi', source: 'report_request',
  });
  assert.deepEqual(calls, [
    ['rpc/dg_park_author', { park: 25 }],
    ['v_report_authors', { park_id: 'eq.25', order: 'created_at.desc', limit: '1' }],
  ]);
});

test('report author: request source errors retain the bounded unavailable note', async () => {
  const rest = async (table) => {
    if (table === 'rpc/dg_park_author') throw new Error('migration missing');
    throw new Error('x'.repeat(200));
  };
  const author = await resolveReportAuthor(25, rest);
  assert.equal(author.source, 'unavailable');
  assert.equal(author.name, null);
  assert.equal(author.full_name, null);
  assert.equal(author.note.length, 120);
});

test('report author: missing names preserve the unresolved institutional fallback contract', async () => {
  const rest = async () => [{ full_name: '   ' }];
  assert.deepEqual(await resolveReportAuthor(25, rest), {
    name: null, full_name: null, source: 'unresolved',
  });
});
