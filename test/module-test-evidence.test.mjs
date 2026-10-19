import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {collectModuleTestEvidence,validateEvidenceExceptions} from '../scripts/lib/module-test-evidence.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('new module evidence gaps require a documented exception instead of implying complete coverage',()=>{
 const inventory=collectModuleTestEvidence(root),exceptions=JSON.parse(readFileSync(new URL('../docs/module-test-evidence-exceptions.json',import.meta.url),'utf8')).exceptions;
 assert.deepEqual(validateEvidenceExceptions(inventory.missing,exceptions),[]);
 assert.ok(inventory.rows.length>900);
});
test('evidence inventory rejects new gaps, duplicates, empty reasons and obsolete exceptions',()=>{
 assert.equal(validateEvidenceExceptions(['example'],[]).length,1);
 assert.equal(validateEvidenceExceptions(['example'],[{module:'example',reason:''}]).length,1);
 assert.equal(validateEvidenceExceptions([], [{module:'example',reason:'historical'}]).length,1);
 assert.equal(validateEvidenceExceptions(['example'],[{module:'example',reason:'documented'},{module:'example',reason:'duplicate'}]).length,1);
});
