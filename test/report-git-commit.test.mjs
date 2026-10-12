import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readReportGitCommit } from '../scripts/lib/report-git-commit.mjs';

test('report Git adapter runs the existing quiet HEAD command from the repository root', () => {
  const calls = [];
  const result = readReportGitCommit('/repo', (command, options) => {
    calls.push([command, options]);
    return 'abc123\n';
  });

  assert.equal(result, 'abc123\n');
  assert.deepEqual(calls, [[
    'git rev-parse HEAD',
    { cwd: '/repo', encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ]]);
});
