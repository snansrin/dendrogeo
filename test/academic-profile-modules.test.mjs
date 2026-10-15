import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadModules() {
  const context = vm.createContext({ window: {}, Object, String });
  for (const file of [
    '../src/application/reports/resolve-academic-profile-defaults.js',
    '../src/ui/academic-profile-fields.js',
    '../src/ui/render-academic-profile.js',
    '../src/ui/save-academic-profile.js',
    '../src/application/reports/create-academic-report-collector.js',
  ]) {
    vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
  }
  return context.window;
}

test('akademik profil varsayılanları eski alan adlarını ve kayıtlı profili birleştirir', () => {
  const modules = loadModules();
  const clean = value => value;
  const result = modules.DG_RESOLVE_ACADEMIC_PROFILE_DEFAULTS.resolve({
    user_metadata: {
      academic_profile: { supervisor: 'Eski danışman', project: 'Eski proje', research_area: 'Ekoloji' },
      dendrogeo_profile: { institution: 'Yeni kurum', project_name: 'Yeni proje' },
    },
  }, clean);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    supervisor: 'Eski danışman', advisor: 'Eski danışman', project: 'Eski proje',
    project_name: 'Yeni proje', research_area: 'Ekoloji', program: 'Ekoloji', institution: 'Yeni kurum',
  });
});

test('akademik alan bileşenleri metni ve örneği HTML için kaçırır', () => {
  const modules = loadModules();
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const examples = { institution: '<script>örnek</script>' };
  const label = modules.DG_ACADEMIC_PROFILE_FIELDS.label('institution', '<Kurum>', true, examples, escape);
  const input = modules.DG_ACADEMIC_PROFILE_FIELDS.input('orcid', 'ORCID', '0000-0002-1825-0097', false, {
    examples, fields: { orcid: 19 }, escape,
  });
  assert.ok(label.includes('&lt;Kurum&gt; *'));
  assert.ok(label.includes('&lt;script&gt;örnek&lt;/script&gt;'));
  assert.ok(input.includes('maxlength="80"'));
  assert.ok(input.includes('inputmode="text"'));
});

test('profil görünümü ORCID ve kaçırılmış kullanıcı alanlarıyla üretilir', () => {
  const modules = loadModules();
  const html = modules.DG_RENDER_ACADEMIC_PROFILE.render({
    name: '<Araştırmacı>', values: { orcid: '0000-0002-1825-0097', institution: '<Kurum>', department: '', advisor: '' },
    fields: [['institution', 'Kurum']],
  }, {
    escape: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    orcidValid: () => true,
    input: () => '<input name="institution">',
  });
  assert.ok(html.includes('Merhaba, &lt;Araştırmacı&gt;'));
  assert.ok(html.includes('ORCID · 0000-0002-1825-0097'));
  assert.ok(html.includes('id="dgAcademicProfileForm"'));
});

test('profil mount görünüm çıktısını verilen elemana yazar',()=>{
  const modules=loadModules(),element={innerHTML:''},profile={name:'Ada',values:{orcid:'',institution:'',department:''},fields:[]};
  const ports={escape:String,orcidValid:()=>false,input:()=>''};
  modules.DG_RENDER_ACADEMIC_PROFILE.mount(element,profile,ports);
  assert.equal(element.innerHTML,modules.DG_RENDER_ACADEMIC_PROFILE.render(profile,ports));
});

test('profil kaydetme doğrulama, başarı ve hata durumlarını portlara aktarır', async () => {
  const modules = loadModules();
  const calls = [];
  const button = { disabled: false };
  const status = { textContent: '' };
  const savedStatus = { textContent: '' };
  const form = { querySelector: () => button };
  const ports = {
    getStatus: () => status, isAuthenticated: () => true, clean: value => value,
    formData: () => [['orcid', 'bad']], orcidValid: value => value !== 'bad',
    update: async () => ({ data: { user: { id: 'u2' } }, error: null }), acceptUser: user => calls.push(user),
    render: () => calls.push('render'), savedStatus: () => savedStatus,
    toast: (...args) => calls.push(args),
  };
  const event = { currentTarget: form, preventDefault: () => calls.push('prevent') };
  await modules.DG_SAVE_ACADEMIC_PROFILE.execute(event, ports);
  assert.equal(status.textContent, 'ORCID kimliğini kontrol edin.');
  assert.equal(button.disabled, false);

  ports.orcidValid = () => true;
  await modules.DG_SAVE_ACADEMIC_PROFILE.execute(event, ports);
  assert.deepEqual(calls.slice(-3), [{ id: 'u2' }, 'render', ['Akademik profiliniz hesabınıza kaydedildi.', 'ok', '👤']]);
  assert.equal(savedStatus.textContent, 'Profil hesabınıza kaydedildi.');
  assert.equal(button.disabled, false);

  ports.update = async () => ({ data: null, error: new Error('RLS reddi') });
  await modules.DG_SAVE_ACADEMIC_PROFILE.execute(event, ports);
  assert.match(status.textContent, /RLS reddi/);
});

test('akademik rapor collector kullanıcı ve park anahtarı ile mevcut factorye bağlanır', async () => {
  const modules = loadModules();
  let args;
  const factory = { createReportPublicationRequestCollector: value => { args = value; return async () => 'collected'; } };
  const collector = modules.DG_CREATE_ACADEMIC_REPORT_COLLECTOR.create(factory, {
    userId: () => 'user-1', getProjectName: () => 'Park projesi',
    collectContext: () => null, insertRequest: () => null, onSubmitted: () => {},
  });
  assert.equal(await collector(42, true), 'collected');
  assert.equal(args.getRequestKey(42), 'user-1:42');
  assert.equal(args.getProjectName(), 'Park projesi');
});
