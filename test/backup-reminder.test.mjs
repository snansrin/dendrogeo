import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/domain/backup/reminder-state.js',import.meta.url),'utf8'),{window,Date});const evaluate=window.DG_BACKUP_REMINDER_STATE.evaluate;
test('backup reminder preserves strict seven-day threshold and floored display',()=>{
 const last='2026-10-01T12:00:00Z',start=Date.parse(last);assert.equal(evaluate(last,start+7*86400000).overdue,false);assert.equal(evaluate(last,start+7*86400000+1).overdue,true);assert.equal(evaluate(last,start+7.9*86400000).elapsedDays,7);assert.equal(evaluate(last,start-86400000).overdue,false);
});
test('backup reminder preserves missing, malformed and empty storage semantics',()=>{
 for(const last of [null,undefined,'']){const r=evaluate(last,0);assert.equal(r.days,999);assert.equal(r.elapsedDays,999);assert.equal(r.overdue,true);}
 const invalid=evaluate('invalid',0);assert.equal(invalid.overdue,false);assert.ok(Number.isNaN(invalid.days));
});
