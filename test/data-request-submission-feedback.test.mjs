import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};vm.runInNewContext(readFileSync(new URL('../src/ui/data-request-submission-feedback.js',import.meta.url),'utf8'),{window});
const ui=window.DG_DATA_REQUEST_SUBMISSION_FEEDBACK_UI;

test('submission feedback preserves duplicate status words and formatted translation',()=>{
 const element={style:{}};
 ui.duplicate(element,'Beklemede');assert.equal(element.style.color,'var(--amber)');assert.equal(element.textContent,'⚠ Aynı filtreyle bir talebiniz zaten beklemede. Yönetici yanıt verene kadar yeni talep oluşturulamaz.');
 ui.duplicate(element,'İşleme Alındı');assert.match(element.textContent,/zaten işleme alındı/);
 let args;ui.duplicate(element,'Beklemede',{translateFormatted:(template,params)=>{args=[template,params.s];return 'Translated pending';}});
 assert.ok(args[0].includes('{s}'));assert.equal(args[1],'beklemede');assert.equal(element.textContent,'Translated pending');
});

test('submission feedback preserves error/success color and plain-text rendering',()=>{
 const element={style:{},innerHTML:'unchanged'};
 ui.failure(element,{message:'<denied>'});assert.equal(element.style.color,'var(--red)');assert.equal(element.textContent,'Hata: <denied>');assert.equal(element.innerHTML,'unchanged');
 ui.success(element);assert.equal(element.style.color,'var(--green-dk)');assert.equal(element.textContent,'✓ Talebiniz yönetime iletildi, hazır olduğunda e‑postanıza gönderilecek.');
});
