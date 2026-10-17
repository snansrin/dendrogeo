import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('English academic landing copy covers current protocol and preserves measurement semantics',()=>{
 const ctx=vm.createContext({});vm.runInContext(read('src/config/i18n-en.js')+';globalThis.dictionary=DG_I18N_EN',ctx);
 const dict=ctx.dictionary;
 for(const key of ['İçeriğe atla','Bölüm menüsü','Chave et al. 2014 (çevre ÷ π → DBH + boy + ρ)','Özel tür ρ değeri yoksa yalnız kendi grup geneli','DBH = göğüs çevresi ÷ π · C/π (cm)','Bilimsel Raporlar','{n} onaylı kayıt']) assert.ok(dict[key],key);
 assert.match(dict['DBH = göğüs çevresi ÷ π · C/π (cm)'],/circumference ÷ π/);
 assert.equal(dict['{n} onaylı kayıt'],'{n} approved records');
});
test('dynamic approved count uses the existing translation template contract',()=>{
 const code=read('src/ui/tree-analysis.js');
 assert.ok(code.includes('data-i18n-text="{n} onaylı kayıt"'));
 assert.ok(code.includes('data-i18n-values="${countValues}"'));
});
