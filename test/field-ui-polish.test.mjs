import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../css/style.css',import.meta.url),'utf8');
const measure=readFileSync(new URL('../src/services/measure.js',import.meta.url),'utf8');
const academic=readFileSync(new URL('../src/services/academic-profile.js',import.meta.url),'utf8');
const context=readFileSync(new URL('../src/core/report-context.js',import.meta.url),'utf8');

describe('Saha ekranı · mobil sadeleştirme sözleşmesi',()=>{
 test('Bir ağaç · bir kayıt etiketi telefonda da görünür',()=>{
  assert.match(shell,/measure-tag">Bir ağaç · bir kayıt/);
  assert.match(css,/@media\(max-width:640px\)[\s\S]*?#v-measure \.measure-tag\{display:inline-flex/);
 });
 test('GPS ana ekranda doğruluk kartı göstermez; aktif durum butona taşınır',()=>{
  const a=shell.indexOf('id="v-measure"'),b=shell.indexOf('id="v-nav"',a),seg=shell.slice(a,b);
  assert.doesNotMatch(seg,/doğruluk \(m\)/);
  assert.match(seg,/id="gpsRing" hidden/);
  assert.match(seg,/id="gpsState"[^>]*hidden/);
  assert.match(measure,/btn\.textContent="GPS aktif"/);
  assert.match(measure,/bd\.textContent="GPS aktif · ±"\+Math\.round\(a\)\+" m · "\+q/);
  assert.match(measure,/a<20\?"":a<40\?" amber":" red"/);
 });
 test('çevre ve boy uzun açıklama yerine erişilebilir soru işareti yardımı kullanır',()=>{
  assert.match(shell,/aria-label="Göğüs çevresi nasıl ölçülür\?"/);
  assert.match(shell,/data-tip="Mezurayı gövdenin etrafına, yerden 1,30 m yüksekte sarın/);
  assert.match(shell,/aria-label="Ağaç boyu nasıl girilir\?"/);
  assert.match(shell,/data-tip="Ağacın zeminden tepe noktasına kadar olan toplam yüksekliğini/);
  assert.match(css,/\.dg-field-help::after\{content:attr\(data-tip\)/);
 });
});

describe('Rapor yayın formu · yönlendirme ve isteğe bağlı akademik alanlar',()=>{
 test('örnekler soru işareti yardım balonlarında kalır',()=>{
  for(const key of ['advisor','institution','purpose','sampling','instruments'])assert.match(academic,new RegExp(key+":"));
  assert.match(academic,/class="dg-field-help"/);
  assert.match(academic,/data-tip=/);
 });
 test('kurum ve danışman validasyonda zorunlu değildir',()=>{
  assert.doesNotMatch(context,/errors\.institution=/);
  assert.doesNotMatch(context,/errors\.advisor=/);
  assert.match(academic,/Danışman \(isteğe bağlı\)/);
  assert.match(academic,/Saha başlangıç tarihi \(isteğe bağlı\)/);
  assert.doesNotMatch(academic,/dgFieldLabel\(k,l,true\).*textarea name=/);
 });
});

describe('Ziyaretçi & Canlı · tema ve hızlı izleme',()=>{
 test('ana tema başlığı, canlı bağlantı rozeti ve hızlı filtreler vardır',()=>{
  assert.match(shell,/class="visitor-heading"/);
  assert.match(shell,/class="visitor-connection"/);
  assert.match(shell,/dgVisQuick\('measure',false\)/);
  assert.match(shell,/dgVisQuick\('nav',false\)/);
  assert.match(shell,/dgVisQuick\('',true\)/);
  assert.match(css,/#v-visitors\{max-width:1120px/);
  assert.match(css,/\.visitor-layout\{display:grid/);
 });
});
