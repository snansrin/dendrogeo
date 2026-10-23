import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const policy=read('supabase/security/20261020_project_waypoint_least_privilege.sql');

test('previously deployed project RLS remains untouched and is verified before updating waypoints',()=>{
 assert.doesNotMatch(policy,/DROP POLICY IF EXISTS "projects_select"/);
 assert.doesNotMatch(policy,/CREATE POLICY "projects_select"/);
 assert.match(policy,/position\('dg_is_park_member' in project_read_rule\) = 0/);
 assert.match(policy,/position\('auth\.uid' in project_read_rule\) = 0/);
 assert.match(policy,/RAISE EXCEPTION 'projects_select must already be restricted/);
});

test('waypoint read policy permits only field owner, admin or same-park collaborators',()=>{
 assert.match(policy,/DROP POLICY IF EXISTS "wp_select" ON public\.waypoints/);
 assert.match(policy,/CREATE POLICY "wp_select" ON public\.waypoints\s+FOR SELECT TO authenticated/);
 const body=policy.split('CREATE POLICY "wp_select"')[1].split('COMMIT;')[0];
 assert.match(body,/owner\s*=\s*\(SELECT auth\.uid\(\)\)/);
 assert.match(body,/\(SELECT private\.is_admin\(\)\)/);
 assert.match(body,/public\.dg_is_park_member\(pr\.park_id\)/);
 assert.match(body,/pr\.id\s*=\s*waypoints\.project_id/);
 assert.doesNotMatch(body,/USING\s*\(\s*true\s*\)/i);
 assert.doesNotMatch(body,/\bTO\s+(?:anon|public)\b/i);
});

test('this migration is transactional, privileges are not broadened and no user records are changed',()=>{
 assert.match(policy,/^BEGIN;[\s\S]+COMMIT;\s*$/m);
 assert.match(policy,/SET LOCAL lock_timeout = '5s'/);
 const executable=policy.replace(/^--[^\n]*\n/gm,'');
 assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|ALTER TABLE|DROP TABLE|SECURITY DEFINER)\b/i);
 assert.doesNotMatch(executable,/\b(?:measurements|surface_reviews|carbon|raster)\b/i);
});
