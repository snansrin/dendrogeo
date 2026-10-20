import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const policy=read('supabase/security/20261020_project_waypoint_least_privilege.sql');

test('project and waypoint SELECT policies require authentication, ownership or collaboration',()=>{
 assert.match(policy,/DROP POLICY IF EXISTS "projects_select" ON public\.projects/);
 assert.match(policy,/CREATE POLICY "projects_select" ON public\.projects\s+FOR SELECT TO authenticated/);
 assert.match(policy,/DROP POLICY IF EXISTS "wp_select" ON public\.waypoints/);
 assert.match(policy,/CREATE POLICY "wp_select" ON public\.waypoints\s+FOR SELECT TO authenticated/);
 const projectPolicy=policy.split('CREATE POLICY "projects_select"')[1].split('DROP POLICY IF EXISTS "wp_select"')[0];
 const waypointPolicy=policy.split('CREATE POLICY "wp_select"')[1].split('COMMIT;')[0];
 for(const item of [projectPolicy,waypointPolicy]){
  assert.match(item,/owner\s*=\s*\(SELECT auth\.uid\(\)\)/);
  assert.match(item,/\(SELECT private\.is_admin\(\)\)/);
  assert.match(item,/public\.dg_is_park_member\(/);
  assert.doesNotMatch(item,/USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(item,/\bTO\s+(?:anon|public)\b/i);
 }
 assert.match(waypointPolicy,/pr\.id\s*=\s*waypoints\.project_id/);
});

test('least-privilege migration only changes two SELECT policies, not GIS, tree formulae or data',()=>{
 assert.match(policy,/^BEGIN;[\s\S]+COMMIT;\s*$/m);
 assert.match(policy,/SET LOCAL lock_timeout = '5s'/);
 const executable=policy.replace(/^--[^\n]*\n/gm,'');
 assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|ALTER TABLE|DROP TABLE|SECURITY DEFINER)\b/i);
 assert.doesNotMatch(executable,/\b(?:measurements|surface_reviews|carbon|raster)\b/i);
});

test('collaborators are resolved through established authenticated park membership helper',()=>{
 assert.match(policy,/AND public\.dg_is_park_member\(park_id\)/);
 assert.match(policy,/AND public\.dg_is_park_member\(pr\.park_id\)/);
 assert.doesNotMatch(policy,/USING\s*\(\s*auth\.role\(\)\s*=\s*'authenticated'/i);
});
