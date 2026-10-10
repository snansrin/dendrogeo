import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/adapters/parks/insert-grid-waypoints.js', import.meta.url), 'utf8'), context);

test('grid waypoint insert writes the supplied rows to the waypoints table and returns the client response', async () => {
  const rows = [{ wp_id: 3, project_id: 9 }, { wp_id: 4, project_id: 9 }];
  const response = { error: { message: 'duplicate key' } };
  const calls = [];
  const client = {
    from(table) {
      calls.push(['from', table]);
      return {
        insert(insertRows) {
          calls.push(['insert', insertRows]);
          return Promise.resolve(response);
        }
      };
    }
  };

  assert.equal(await context.window.DG_GRID_WAYPOINT_INSERT.insert(client, rows), response);
  assert.equal(calls[0][0], 'from');
  assert.equal(calls[0][1], 'waypoints');
  assert.equal(calls[1][0], 'insert');
  assert.equal(calls[1][1], rows);
});
