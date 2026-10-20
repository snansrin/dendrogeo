import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/20261020094000_dendro_photos_listing_rls.sql',import.meta.url),'utf8');

test('photo objects cannot be listed anonymously: SELECT policy is authenticated-only',()=>{
 assert.match(migration,/drop policy if exists "dendro_photos_public_read" on storage\.objects/i);
 assert.match(migration,/create policy "dendro_photos_authorized_select"[\s\S]+for select\s+to authenticated/i);
 assert.match(migration,/bucket_id\s*=\s*'dendro-photos'/i);
 assert.doesNotMatch(migration,/for select\s+to\s+(?:public|anon)\b/i);
});

test('admin can still enumerate all and users their own folder, while keeping real photo URLs',()=>{
 assert.match(migration,/private\.is_admin\(\)/);
 assert.match(migration,/storage\.foldername\(name\)/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/begin;[\s\S]+commit;/i);
 assert.doesNotMatch(migration,/\bupdate\s+(?:storage\.buckets|public\.measurements)\b|\bdelete\s+from\b|\btruncate\b|\balter\s+table\b/i);
 assert.doesNotMatch(migration,/\bpublic\s*=\s*false\b|\bupdate\s+storage\.buckets\b/i);
});

test('owner-only photo ZIP remains a verified read, not a remote write',()=>{
 const workflow=readFileSync(new URL('../src/application/backup/photo-full-workflow.mjs',import.meta.url),'utf8');
 assert.match(workflow,/client\.auth\.getUser\(\)/);
 assert.match(workflow,/profile\.data\?\.role!=='owner'/);
 assert.match(workflow,/readComplete\(window,result\.archive\)/);
 assert.doesNotMatch(workflow,/\.upload\s*\(|\.remove\s*\(|\.delete\s*\(/);
});
