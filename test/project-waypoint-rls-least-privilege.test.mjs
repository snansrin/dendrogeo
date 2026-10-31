import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261031172000_waypoint_project_authorization.sql');
const legacy=read('supabase/security/20261020_project_waypoint_least_privilege.sql');
const part=(name,next)=>migration.split('CREATE POLICY '+name+' ON public.')[1]?.split(next)[0]||'';

test('versioned migration and old emergency script are identical',()=>{
 assert.equal(legacy,migration);
 assert.match(migration.replace(/^--[^\n]*\n/gm,''),/^BEGIN;[\s\S]*COMMIT;\s*$/);
 assert.match(migration,/SET LOCAL lock_timeout = '5s'/);
 assert.doesNotMatch(migration,/\b(?:INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE)\b/i);
});
test('preflight checks the current, restricted project RLS and retained lock trigger',()=>{
 assert.match(migration,/position\('private\.dg_shared_project_access' in project_rule\) = 0/);
 assert.match(migration,/position\('auth\.uid' in project_rule\) = 0/);
 assert.match(migration,/PROJECT_ACCESS_POLICY_MISMATCH/);
 assert.match(migration,/dg_waypoint_completion_guard/);
 assert.doesNotMatch(migration,/position\('dg_is_park_member' in project_rule\)/);
 assert.doesNotMatch(migration,/DROP POLICY[^\n]*projects_select/i);
});
test('SELECT is project scoped; former point owner without membership cannot enumerate',()=>{
 const p=part('wp_select','DROP POLICY IF EXISTS wp_insert');
 assert.match(p,/FOR SELECT TO authenticated/);
 assert.match(p,/pr\.id = waypoints\.project_id/);
 assert.match(p,/pr\.owner = \(SELECT auth\.uid\(\)\)/);
 assert.match(p,/private\.dg_shared_project_access\(pr\.id\)/);
 assert.doesNotMatch(p,/\bowner = \(SELECT auth\.uid\(\)\)\s+OR\s+EXISTS/);
 assert.doesNotMatch(p,/USING\s*\(\s*true\s*\)/i);
});
test('INSERT requires active owner and authorized unlocked project (admins remain supported)',()=>{
 const p=part('wp_insert','DROP POLICY IF EXISTS wp_update');
 for(const s of ['FOR INSERT TO authenticated','WITH CHECK','owner = (SELECT auth.uid())',
  '(SELECT private.is_active())','pr.id = waypoints.project_id','NOT pr.is_locked',
  'private.dg_shared_project_access(pr.id)','(SELECT private.is_admin())'])assert.ok(p.includes(s),s);
});
test('UPDATE requires BOTH old and new project authorization and blocks locked projects',()=>{
 const p=part('wp_update','DROP POLICY IF EXISTS wp_delete');
 assert.match(p,/FOR UPDATE TO authenticated/);
 assert.match(p,/USING[\s\S]*WITH CHECK/);
 assert.ok((p.match(/NOT pr\.is_locked/g)||[]).length>=2);
 assert.ok((p.match(/pr\.id = waypoints\.project_id/g)||[]).length>=2);
 assert.ok((p.match(/private\.dg_shared_project_access\(pr\.id\)/g)||[]).length>=2);
});
test('DELETE requires project ownership or current membership and respects lock',()=>{
 const p=part('wp_delete','-- Preserve the exact OR');
 assert.match(p,/FOR DELETE TO authenticated/);
 assert.match(p,/NOT pr\.is_locked/);
 assert.match(p,/waypoints\.owner = \(SELECT auth\.uid\(\)\) AND private\.dg_shared_project_access\(pr\.id\)/);
});
test('park DELETE policy consolidation preserves both administrator and staged park owner',()=>{
 assert.match(migration,/PARK_DELETE_POLICY_MISMATCH/);
 const p=part('parks_delete','-- A missing reference-side index');
 for(const s of ['(SELECT private.is_admin())',"osm_key ~ '^stage/[0-9]+/[a-f0-9]{32}$'",
  "'dendrogeo/park-stage/1'",'created_by = (SELECT auth.uid())','(SELECT private.is_active())'])assert.ok(p.includes(s),s);
 assert.match(migration,/DROP POLICY IF EXISTS parks_stage_owner_delete ON public\.parks/);
});
test('only missing projects locked-by reference index added',()=>{
 assert.match(migration,/CREATE INDEX IF NOT EXISTS idx_projects_locked_by ON public\.projects \(locked_by\)/);
 assert.doesNotMatch(migration.replace(/^--.*$/gm,''),/\b(?:allometry|wood_density|carbon_kg|measurements)\b/i);
});
