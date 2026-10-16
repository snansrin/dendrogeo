"use strict";

window.DG_RENDER_ACADEMIC_PROFILE = (() => {
  const bindings=new WeakSet(),actionsByElement=new WeakMap();
  function bind(element,actions){
    if(!element||typeof element.addEventListener!=="function")return;
    actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);
    element.addEventListener("click",event=>{
      const button=event.target?.closest?.("[data-academic-profile-action]");
      if(!button||!element.contains(button))return;
      const action=button.dataset.academicProfileAction;
      if(action==='edit'){window.DG_ACADEMIC_PROFILE_INTERACTIONS.edit(element,button.dataset.profileField);return;}
      if(action==='cancel'){window.DG_ACADEMIC_PROFILE_INTERACTIONS.cancel(element);return;}
      const navigate=actionsByElement.get(element)?.navigate;
      if(typeof navigate==="function")navigate(button.dataset.academicProfileAction);
    });
    element.addEventListener('input',event=>{if(event.target?.closest?.('[data-academic-profile-form]'))window.DG_ACADEMIC_PROFILE_INTERACTIONS.refresh(element);});
    element.addEventListener("submit",event=>{
      const form=event.target;
      if(!form?.matches?.("[data-academic-profile-form]")||!element.contains(form))return;
      event.preventDefault();const save=actionsByElement.get(element)?.save;
      if(typeof save==="function")save(event);
    });
  }
  function render(profile, ports) {
    const summary=window.DG_RESOLVE_ACADEMIC_PROFILE_DEFAULTS.summarize(profile);
    const initials = profile.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('');
    const orcid = profile.values.orcid && ports.orcidValid(profile.values.orcid)
      ? `<p class="dg-profile-orcid"><a href="https://orcid.org/${ports.escape(profile.values.orcid)}" target="_blank" rel="noopener" aria-label="ORCID · ${ports.escape(profile.values.orcid)} — ORCID kaydını aç">ORCID · ${ports.escape(profile.values.orcid)}</a><small>Kaydedilmiş kimlik · ORCID hesabıyla doğrulanmamış</small></p>` : '';
    const e=ports.escape;
    const fieldGroup=(title,keys)=>{const fields=profile.fields.filter(([key])=>keys.includes(key));return fields.length?`<fieldset class="dg-profile-fieldset"><legend>${e(title)}</legend><div class="dg-academic-grid">${fields.map(([key,label])=>ports.input(key,label,profile.values[key])).join('')}</div></fieldset>`:'';};
    return `<div class="dg-profile-heading"><span class="dg-profile-avatar" aria-hidden="true">${e(initials)}</span><div><div class="dg-kicker">ARAŞTIRMACI PROFİLİ</div><h2>Merhaba, ${e(profile.name)}</h2><p class="dg-meta">${e([summary.institution,summary.department].filter(Boolean).join(' · ')||'Saha çalışmalarınız ve akademik bilgileriniz bir arada.')}</p></div><button type="button" class="btn sm ghost" data-academic-profile-action="edit">Profili düzenle</button></div>
    <div class="dg-profile-overview"><section><span class="lbl">Araştırma / proje</span><h3>${e(summary.project||'Çalışma adınızı ekleyin')}</h3><p class="dg-meta">${e(summary.program||'Çalışma alanınızı profilinizde tanımlayabilirsiniz.')}</p><button type="button" class="btn sm ghost" data-academic-profile-action="edit" data-profile-field="project_name">Çalışma bilgileri</button></section><section><span class="lbl">Araştırmacı kimliği</span>${orcid||'<p class="dg-meta">ORCID kimliğinizi ekleyerek araştırmacı künyenizi tamamlayabilirsiniz.</p>'}<button type="button" class="btn sm ghost" data-academic-profile-action="edit" data-profile-field="orcid">Kimlik bilgileri</button></section></div>
    <div class="dg-profile-completion"><div><span class="dg-meta">İsteğe bağlı profil bilgileri</span><b class="dg-meta" data-profile-count>${summary.filled} / ${summary.total} bilgi</b></div><progress data-profile-progress aria-label="Doldurulan isteğe bağlı profil bilgileri" value="${summary.filled}" max="${Math.max(1,summary.total)}"></progress><p class="dg-meta" data-profile-draft-status role="status">Bilgileriniz güncel. Tüm alanlar isteğe bağlıdır.</p></div>
    <p id="dgAcademicSavedStatus" class="dg-meta" role="status" tabindex="-1"></p><div class="dg-profile-actions" aria-label="Çalışma kısayolları"><button type="button" class="btn sm" data-academic-profile-action="measure">🌳 Yeni ölçüm</button><button type="button" class="btn sm ghost" data-academic-profile-action="map">🗺 Canlı harita</button><button type="button" class="btn sm ghost" data-academic-profile-action="records">📋 Kayıtlarım</button><button type="button" class="btn sm ghost" data-academic-profile-action="projects">📁 Projelerim</button></div>
    <details data-profile-editor><summary>Akademik bilgilerimi düzenle</summary><p class="dg-meta">Bu bilgiler hesabınıza özeldir. Rapor yayımlarken hangi bilgilerin herkese açılacağını ayrıca seçersiniz.</p><form id="dgAcademicProfileForm" data-academic-profile-form>${fieldGroup('Kurum ve çalışma alanı',['institution','department','program','advisor'])}${fieldGroup('Araştırmacı kimliği ve proje',['orcid','project_name'])}<p id="dgAcademicProfileStatus" class="dg-meta" role="status"></p><div class="dg-profile-form-actions"><button class="btn" type="submit" disabled>Profili kaydet</button><button type="button" class="btn ghost" data-academic-profile-action="cancel">Vazgeç</button></div></form></details><p class="dg-profile-publications"><a href="rapor/" target="_blank" rel="noopener">Yayımlanan bilimsel raporları inceleyin ↗</a></p>`;
  }

  function mount(element, profile, ports) {
    if (element) { element.innerHTML = render(profile, ports); bind(element,ports);window.DG_ACADEMIC_PROFILE_INTERACTIONS.refresh(element); }
  }

  return Object.freeze({ render, mount, bind });
})();
