import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('GPS Presence uses private channels and installs JWT before either join',()=>{
 const visitor=read('src/adapters/visitors/presence-channel.js');
 const park=read('src/adapters/parks/park-presence-channel.js');
 const lifecycle=read('src/application/visitors/start-presence-session.js');
 assert.match(visitor,/config:\{private:true,presence:/);
 assert.match(park,/config:\{private:true,presence:/);
 assert.ok(lifecycle.indexOf('await')<0,'lifecycle remains nonblocking while auth resolves asynchronously');
 assert.ok(lifecycle.indexOf('authorize')<lifecycle.indexOf('channelAdapter.subscribe'));
 assert.match(park,/await client\.realtime\.setAuth\(token\)/);
});

test('Realtime authorization migration limits transient GPS by active owner or park member',()=>{
 const migration=read('supabase/migrations/20261015073309_realtime_presence_authorization.sql');
 assert.doesNotMatch(migration,/alter\s+table\s+realtime\.messages\s+enable\s+row\s+level\s+security/i);
 for(const policy of ['dg_presence_owner_read','dg_presence_active_publish','dg_park_presence_member_read','dg_park_presence_member_publish'])assert.match(migration,new RegExp(`create policy ${policy}`));
 assert.match(migration,/to authenticated[\s\S]*?private\.is_owner\(\)/);
 assert.match(migration,/private\.is_active\(\)/);
 assert.match(migration,/public\.dg_is_park_member/);
 assert.match(migration,/private\.dg_presence_park_topic_id/);
 assert.match(migration,/alter function public\.dg_invite_(?:send|respond|revoke)[\s\S]*?set search_path = ''/);
 assert.doesNotMatch(migration,/grant\s+.*\banon\b/i);
});
