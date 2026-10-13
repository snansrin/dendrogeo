import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'src/domain/auth/resolve-turnstile-form.js',
  'src/adapters/auth/load-turnstile-script.js',
  'src/ui/turnstile-widget.js',
  'src/application/auth/turnstile-controller.js',
  'src/domain/auth/read-turnstile-token.js',
];
function runtime(window = {}) {
  const context = { window, console: { warn() {} } };
  vm.createContext(context);
  for (const path of paths) vm.runInContext(readFileSync(join(ROOT, path), 'utf8'), context);
  return context.window;
}

test('Turnstile form resolver selects login, register, and reset widgets', () => {
  const api = runtime();
  assert.equal(api.DG_TURNSTILE_FORM.resolve('login'), 'tsLogin');
  assert.equal(api.DG_TURNSTILE_FORM.resolve('reg'), 'tsReg');
  assert.equal(api.DG_TURNSTILE_FORM.resolve('reset'), 'tsReset');
  assert.equal(api.DG_TURNSTILE_FORM.resolve('unknown'), 'tsLogin');
});

test('script adapter loads once, supports an existing global, and resets after failure', () => {
  const api = runtime();
  const scripts = [];
  const document = { createElement: () => ({ remove() {} }), head: { appendChild: (script) => scripts.push(script) } };
  let loaded = 0;
  api.DG_TURNSTILE_SCRIPT_LOADER.load({ window: api, document, available: false, onLoad: () => loaded++ });
  api.DG_TURNSTILE_SCRIPT_LOADER.load({ window: api, document, available: false, onLoad: () => loaded++ });
  assert.equal(scripts.length, 1);
  assert.match(scripts[0].src, /render=explicit/);
  scripts[0].onload();
  assert.equal(loaded, 1);
  scripts[0].onerror();
  assert.equal(api._tsLoadStarted, false);
  api.DG_TURNSTILE_SCRIPT_LOADER.load({ window: api, document, available: true, onLoad: () => loaded++ });
  assert.equal(loaded, 2);
});

test('widget UI removes inactive widget and renders only selected form', () => {
  const api = runtime();
  const removed = [];
  const rendered = [];
  const widgets = { tsLogin: 'login-widget' };
  api.DG_TURNSTILE_WIDGET.activate({
    api: { remove: (id) => removed.push(id), render: (element, options) => { rendered.push([element.id, options]); return 'reset-widget'; } },
    widgets, activeId: 'tsReset', getElement: (id) => ({ id }),
  });
  assert.deepEqual(removed, ['login-widget']);
  assert.equal(widgets.tsReset, 'reset-widget');
  assert.equal(rendered[0][0], 'tsReset');
  assert.equal(rendered[0][1].theme, 'light');
});

test('controller waits for the auth section to intersect and initializes just one widget', () => {
  let observe;
  let disconnected = false;
  const api = runtime({
    IntersectionObserver: class { constructor(callback, options) { observe = { callback, options }; } observe() {} disconnect() { disconnected = true; } },
  });
  let loads = 0;
  api.DG_TURNSTILE_CONTROLLER.schedule({
    window: api, document: { getElementById: () => ({}) }, load: () => loads++,
  });
  assert.equal(loads, 0);
  assert.equal(observe.options.rootMargin, '300px');
  observe.callback([{ isIntersecting: true }]);
  assert.equal(api._tsVisible, true);
  assert.equal(loads, 1);
  assert.equal(disconnected, true);

  const calls = [];
  api.DG_TURNSTILE_CONTROLLER.initialize({
    window: api, api: { render: (element) => { calls.push(element.id); return 'widget'; }, remove() {} },
    tab: 'reg', widgets: {}, getElement: (id) => ({ id }),
  });
  assert.deepEqual(calls, ['tsReg']);
});

test('token reader returns no token on missing widget or Turnstile errors', () => {
  const api = runtime();
  assert.equal(api.DG_TURNSTILE_TOKEN.read('tsLogin', { api: null, widgets: {} }), null);
  assert.equal(api.DG_TURNSTILE_TOKEN.read('tsLogin', { api: { getResponse: () => { throw Error('expired'); } }, widgets: { tsLogin: 'widget' } }), null);
  assert.equal(api.DG_TURNSTILE_TOKEN.read('tsLogin', { api: { getResponse: () => 'token-1' }, widgets: { tsLogin: 'widget' } }), 'token-1');
});
