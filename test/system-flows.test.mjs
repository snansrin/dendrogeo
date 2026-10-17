import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import {validateFlows,renderMarkdown,renderExplorer,normalizeFlowSearch} from '../scripts/render-system-flows.mjs';
const data=JSON.parse(readFileSync(new URL('../docs/academic/2026-10-17/workflows.json',import.meta.url),'utf8'));
test('functional diagrams cover every shell view and resolve evidence and graph edges',()=>{
 assert.equal(validateFlows(data),true);assert.equal(data.flows.length,24);
 const markdown=renderMarkdown(data);
 assert.equal((markdown.match(/```mermaid/g)||[]).length,24);
 assert.match(markdown,/allometri/);
 assert.equal(readFileSync(new URL('../docs/SYSTEM-FLOWS-2026-10-17.md',import.meta.url),'utf8'),markdown);
 assert.equal(readFileSync(new URL('../docs/academic/2026-10-17/flow-explorer.html',import.meta.url),'utf8'),renderExplorer(data));
});
test('offline explorer has no external script dependencies and its inline JavaScript parses',()=>{
 const html=renderExplorer(data);
 assert.doesNotMatch(html,/<script\b[^>]*\bsrc=/i);
 const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>parse(code,{ecmaVersion:'latest'}));
 assert.match(html,/Geçişler ve kararlar/);
 assert.match(html,/type="search"/);
});

test('flow search matches NDVI independently of English and Turkish I casing',()=>{
 assert.equal(normalizeFlowSearch('NDVI'),normalizeFlowSearch('ndvi'));
 assert.equal(normalizeFlowSearch('SINIR'),normalizeFlowSearch('sınır'));
});
