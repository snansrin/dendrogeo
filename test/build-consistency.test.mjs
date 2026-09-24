/* build-consistency.test.mjs — partials → index.html üretim zincirinin bekçisi.
 *
 * index.html bir artifakttır: partials/{head,landing,shell,boot}.html
 * birleşimi + taze ?v= hash'lerinden üretilir (scripts/build-index.mjs).
 * Bu test zinciri üç yönden kilitler:
 *   1) dört partial da mevcut ve çapa noktaları (toast/landing/shell/boot)
 *      index.html'de tam birer kez, doğru sırada geçiyor
 *   2) build --check exit 0 (index.html diskteki hâliyle üretimle birebir)
 *   3) landing modülü İZOLASYONU: partials/landing.html uygulama kabuğunun
 *      kimliklerini (v-* view'ları, #side, #apptop…) İÇERMEZ; shell.html de
 *      landing bölümlerini (#topnav, hero, statband, blk section'ları) içermez.
 *      Böylece "landing değişikliği uygulamaya sızmaz" garantisi yapısal olur.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = (f) => join(ROOT, 'partials', f);
const read = (f) => readFileSync(P(f), 'utf8');

describe('partials bütünlüğü', () => {
  test('dört partial da mevcut', () => {
    for (const f of ['head.html', 'landing.html', 'shell.html', 'boot.html']) {
      assert.ok(existsSync(P(f)), 'eksik partial: ' + f);
    }
  });

  test('build --check yeşil (index.html == partials birleşimi)', () => {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-index.mjs'), '--check'],
      { cwd: ROOT, stdio: 'pipe' });
  });

  test('çapalar index.html’de tam birer kez ve doğru sırada', () => {
    const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const anchors = ['<div id="toastWrap"></div>', '<div id="landing">', '<div id="shell">', '<script src="src/ui/state.js'];
    let prev = -1;
    for (const a of anchors) {
      const first = idx.indexOf(a);
      assert.ok(first > -1, 'çapa yok: ' + a);
      assert.equal(idx.indexOf(a, first + 1), -1, 'çapa birden fazla: ' + a);
      assert.ok(first > prev, 'çapa sırası bozuk: ' + a);
      prev = first;
    }
  });
});

describe('landing ↔ shell izolasyonu', () => {
  const landing = read('landing.html');
  const shell = read('shell.html');

  test('landing.html uygulama kabuğu kimliklerini içermez', () => {
    for (const s of ['id="shell"', 'id="apptop"', 'id="side"', 'id="layout"', 'id="main"',
                     'id="v-dash"', 'id="v-measure"', 'id="v-admin"', 'id="recoveryModal"', 'id="previewModal"']) {
      assert.ok(!landing.includes(s), 'landing.html içine sızmış: ' + s);
    }
  });

  test('shell.html landing bölümlerini içermez', () => {
    for (const s of ['id="landing"', 'id="topnav"', 'class="hero"', 'statband', 'bilgi-merkezi', 'id="erisim"']) {
      assert.ok(!shell.includes(s), 'shell.html içine sızmış: ' + s);
    }
  });

  test('boot dosyaları head.html’de DEĞİL, boot.html’de (sıra kilidi)', () => {
    const head = read('head.html');
    for (const f of ['state.js', 'toast.js', 'landing.js', 'shell.js']) {
      assert.ok(!head.includes('src/ui/' + f), 'boot dosyası head’e sızmış: ' + f);
    }
    const boot = read('boot.html');
    for (const f of ['state.js', 'toast.js', 'landing.js', 'shell.js']) {
      assert.ok(boot.includes('src/ui/' + f), 'boot.html’de eksik: ' + f);
    }
    // boot sırası: state → toast → landing → shell (shell.js sonunda boot() çağrısı var)
    const pos = ['state.js', 'toast.js', 'landing.js', 'shell.js'].map((f) => boot.indexOf('src/ui/' + f));
    assert.deepEqual(pos, [...pos].sort((a, b) => a - b), 'boot.html tag sırası bozuk');
  });
});
