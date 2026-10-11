import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context={window:{}};
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../src/ui/park-admin-status.js',import.meta.url),'utf8'),context);
const ui=context.window.DG_PARK_ADMIN_STATUS_UI;
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const box=()=>({style:{display:'none'},innerHTML:''});

test('backfill status renderers preserve messages and reveal the panel',()=>{
  const offline=box();
  ui.backfillOffline(offline);
  assert.equal(offline.style.display,'block');
  assert.equal(offline.innerHTML,'<div class="alert err">⛔ Park geri doldurma internet gerektirir (OSM/Overpass sorgusu).</div>');

  const failed=box();
  ui.backfillLoadFailed(failed,{message:'<kapalı>'},escape);
  assert.equal(failed.style.display,'block');
  assert.equal(failed.innerHTML,'<div class="alert err">⚠ Projeler okunamadı: <span class="mono">&lt;kapalı&gt;</span></div>');

  const empty=box();
  ui.backfillNoTargets(empty);
  assert.equal(empty.style.display,'block');
  assert.equal(empty.innerHTML,'<div class="alert ok">✓ Park bağı eksik proje yok — hepsi bir parka bağlı.</div>');
});

test('park administration loading and error renderers preserve display behavior',()=>{
  const loading=box();
  ui.parkLoading(loading);
  assert.equal(loading.style.display,'none');
  assert.equal(loading.innerHTML,'<div class="alert info">⏳ Park kimlikleri yükleniyor…</div>');

  const failed=box();
  ui.parkLoadFailed(failed,{message:'<RLS>'},escape);
  assert.equal(failed.style.display,'none');
  assert.equal(failed.innerHTML,'<div class="alert err">⚠ Parklar okunamadı: <span class="mono">&lt;RLS&gt;</span></div>');
});

test('status renderers safely do nothing without a panel',()=>{
  assert.doesNotThrow(()=>ui.backfillOffline(null));
  assert.doesNotThrow(()=>ui.parkLoading(null));
});
