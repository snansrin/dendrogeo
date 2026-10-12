import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/domain/users/summarize-admin-users.js',import.meta.url),'utf8'),{window});
test('user summary preserves role classification, active truthiness and empty counts without mutation',()=>{
 const users=[{role:'owner',active:true},{role:'admin',active:false},{role:'user',active:1},{role:'Admin',active:null},{}],before=JSON.stringify(users);
 assert.deepEqual(JSON.parse(JSON.stringify(window.DG_USER_ADMIN_SUMMARY.summarize(users))),{total:5,active:2,admins:2,passive:3});assert.equal(JSON.stringify(users),before);
 assert.deepEqual(JSON.parse(JSON.stringify(window.DG_USER_ADMIN_SUMMARY.summarize([]))),{total:0,active:0,admins:0,passive:0});
});
