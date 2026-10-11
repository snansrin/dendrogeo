import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context={window:{}};
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../src/ui/park-schema-warning.js',import.meta.url),'utf8'),context);
const ui=context.window.DG_PARK_SCHEMA_WARNING_UI;

test('available park schema renders no warning',()=>{
  assert.equal(ui.render({available:true}),'');
});

test('missing park schema preserves its shared warning markup',()=>{
  assert.equal(ui.render({available:false}),'<div class="alert warn" style="margin:6px 0"><b>⚠ Park kimliği devre dışı:</b> veritabanında <span class="mono">public.parks</span> yok. <span class="mono">supabase/migrations/0004_parks.sql</span> çalıştırılana kadar karşılaştırma proje adı bazında kalır ve ölçüm kapısı uygulanamaz.</div>');
});
