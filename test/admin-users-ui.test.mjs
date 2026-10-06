import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/services/user-admin.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../css/style.css',import.meta.url),'utf8');

describe('Kullanıcı yönetimi · kompakt DendroGeo tema sözleşmesi',()=>{
 test('özet kartları uzun bloklar yerine kompakt durum şeridi',()=>{
  assert.match(shell,/class="admin-users-summary"/);
  assert.match(shell,/id="aUsersTotal"/);
  assert.match(shell,/id="aUsersActive"/);
  assert.match(shell,/id="aUsersAdmin"/);
  assert.match(shell,/id="aUsersPassive"/);
  assert.doesNotMatch(shell,/admin-users-stats/);
 });
 test('hesap satırı kimliği tek kompakt hücrede birleştirir',()=>{
  assert.match(shell,/<th scope="col">Kullanıcı<\/th><th scope="col">Rol<\/th><th scope="col">Durum<\/th><th scope="col">İşlem<\/th>/);
  assert.match(js,/class="admin-user-person"/);
  assert.match(js,/class="admin-user-avatar"/);
  assert.match(js,/class="admin-user-identity"/);
  assert.match(js,/data-label="Kullanıcı"/);
 });
 test('rol ve aktiflik yetkileri korunur',()=>{
  assert.match(js,/if\(PROFILE\.role!=="owner"\)return toast/);
  assert.match(js,/updateRole\('/);
  assert.match(js,/toggleU\('/);
  assert.match(js,/ownerRow/);
  assert.match(js,/🛡 Korunuyor/);
 });
 test('masaüstü ve telefon satırları sıkı, dokunma hedefleri mobilde yeterli',()=>{
  assert.match(css,/#v-users \.admin-users-table td\{padding:7px 10px/);
  assert.match(css,/#v-users \.admin-user-avatar\{width:30px;height:30px/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/#v-users \.admin-user-actions \.btn\{min-height:40px/);
  assert.match(css,/#v-users \.admin-users-toolbar input,#v-users \.admin-users-toolbar select\{min-height:44px/);
 });
});
