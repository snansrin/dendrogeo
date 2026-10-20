import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/security/20261020_photo_bucket_upload_limits.sql');

test('photo storage guard only changes one existing bucket upload configuration',()=>{
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/i);
 assert.match(sql,/WHERE b\.id\s*=\s*'dendro-photos'/i);
 assert.match(sql,/file_size_limit\s*=\s*8388608/i);
 assert.match(sql,/allowed_mime_types\s*=\s*ARRAY\['image\/jpeg'\]::text\[\]/i);
 assert.match(sql,/IF NOT FOUND OR v_public IS DISTINCT FROM TRUE/i);
 assert.match(sql,/v_incompatible\s*<>\s*0/);
 // Never silently edit existing photos or their public URLs.
 assert.doesNotMatch(sql,/\b(?:DELETE|INSERT)\s+(?:INTO|FROM)\s+storage\./i);
 assert.doesNotMatch(sql,/\bUPDATE\s+(?:public\.measurements|storage\.objects|storage\.migrations)\b/i);
 assert.doesNotMatch(sql,/\bALTER\s+TABLE\b|\bDROP\s+POLICY\b|\bTRUNCATE\b/i);
 assert.doesNotMatch(sql,/SET\s+public\s*=\s*false/i);
});

test('existing online and offline photo uplinks are compressed JPEG',()=>{
 const online=read('src/adapters/trees/upload-measurement-photo.js');
 const offline=read('src/adapters/offline/upload-queued-measurement-photo.js');
 const compressor=read('src/ui/compress-measurement-photo.js');
 for(const source of [online,offline]){
  assert.match(source,/contentType:\s*["']image\/jpeg["']/);
  assert.match(source,/\.jpg/);
 }
 assert.match(compressor,/toBlob\([\s\S]*["']image\/jpeg["']/);
 assert.match(compressor,/maxSide=1024/);
});

test('existing owner-only photo archive and upload RLS remain unchanged',()=>{
 const existing=read('supabase/security/20261020_dendro_photos_listing_rls.sql');
 assert.match(existing,/for select\s+to authenticated/i);
 assert.match(existing,/storage\.foldername\(name\)/);
 assert.match(read('src/application/backup/photo-full-workflow.mjs'),/profile\.data\?\.role!=='owner'/);
});
