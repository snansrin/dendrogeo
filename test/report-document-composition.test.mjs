import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReportDocumentRenderer} from '../scripts/lib/report-document-composition.mjs';

const source=readFileSync(new URL('../scripts/make-report.mjs',import.meta.url),'utf8');

test('report document composition is injected and make-report retains its public renderer',()=>{
 assert.equal(typeof createReportDocumentRenderer,'function');
 assert.match(source,/import \{createReportDocumentRenderer\} from '\.\/lib\/report-document-composition\.mjs'/);
 assert.match(source,/export \{renderReport\}/);
});

test('document composition contains no data access or publication side effects',()=>{
 const module=readFileSync(new URL('../scripts/lib/report-document-composition.mjs',import.meta.url),'utf8');
 assert.match(module,/return function renderReport/);
 assert.doesNotMatch(module,/\b(fetch|readFileSync|writeFileSync|execSync|publishPark)\s*\(/);
});
