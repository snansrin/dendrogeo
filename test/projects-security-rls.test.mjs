import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../supabase/security/20261020111203_restrict_authenticated_projects_read_to_members.sql',import.meta.url),'utf8');

test('authenticated project rows are restricted to ownership, admin or explicit park participation',()=>{
 assert.match(src,/ALTER POLICY projects_select ON public\.projects/);
 assert.match(src,/TO authenticated/);
 assert.match(src,/owner\s*=\s*\(SELECT auth\.uid\(\)\)/);
 assert.match(src,/private\.is_admin\(\)/);
 assert.match(src,/public\.dg_is_park_member\(park_id\)/);
 assert.doesNotMatch(src,/\bUSING\s*\(\s*true\s*\)/i);
 assert.doesNotMatch(src,/\b(?:DELETE|TRUNCATE|DROP|UPDATE|INSERT)\b/i);
});

test('free-plan security guard forbids Supabase Logs Query API from any automatic app or CI path',()=>{
 const guard=readFileSync(new URL('../test/free-plan-security-surface.test.mjs',import.meta.url),'utf8');
 assert.match(guard,/production scripts\/workflows do not poll Supabase Logs Query APIs/);
 assert.match(guard,/query_logs/);
});
