"use strict";

window.DG_RENDER_ACADEMIC_PROFILE = (() => {
  const bindings=new WeakSet(),actionsByElement=new WeakMap();
  function bind(element,actions){
    if(!element||typeof element.addEventListener!=="function")return;
    actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);
    element.addEventListener("click",event=>{
      const button=event.target?.closest?.("[data-academic-profile-action]");
      if(!button||!element.contains(button))return;
      const navigate=actionsByElement.get(element)?.navigate;
      if(typeof navigate==="function")navigate(button.dataset.academicProfileAction);
    });
    element.addEventListener("submit",event=>{
      const form=event.target;
      if(!form?.matches?.("[data-academic-profile-form]")||!element.contains(form))return;
      event.preventDefault();const save=actionsByElement.get(element)?.save;
      if(typeof save==="function")save(event);
    });
  }
  function render(profile, ports) {
    const initials = profile.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('');
    const orcid = profile.values.orcid && ports.orcidValid(profile.values.orcid)
      ? `<p class="dg-profile-orcid"><a href="https://orcid.org/${ports.escape(profile.values.orcid)}" target="_blank" rel="noopener" aria-label="ORCID kaydını aç">ORCID · ${ports.escape(profile.values.orcid)}</a><small>Kaydedilmiş kimlik · ORCID hesabıyla doğrulanmamış</small></p>` : '';
    const fields = profile.fields.map(([key, label]) => ports.input(key, label, profile.values[key])).join('');
    return `<div class="dg-profile-heading"><span class="dg-profile-avatar" aria-hidden="true">${ports.escape(initials)}</span><div><div class="dg-kicker">ARAŞTIRMACI PROFİLİ</div><h2>Merhaba, ${ports.escape(profile.name)}</h2><p class="dg-meta">${ports.escape([profile.values.institution, profile.values.department].filter(Boolean).join(' · ') || 'Saha çalışmalarınız ve akademik bilgileriniz bir arada.')}</p></div></div>${orcid}<p id="dgAcademicSavedStatus" class="dg-meta" role="status"></p><div class="dg-profile-actions"><button class="btn sm" data-academic-profile-action="measure">🌳 Yeni ölçüm</button><button class="btn sm blue" data-academic-profile-action="projects">📁 Projelerim</button><a class="btn sm ghost" href="rapor/" target="_blank" rel="noopener">📄 Yayınlar</a></div><details><summary>Akademik bilgilerimi düzenle</summary><p class="dg-meta">Bu bilgiler hesabınızda saklanır. Rapor yayımlarken hangi bilgilerin herkese açılacağını ayrıca kontrol edersiniz.</p><form id="dgAcademicProfileForm" data-academic-profile-form><div class="dg-academic-grid">${fields}</div><p id="dgAcademicProfileStatus" class="dg-meta" role="status"></p><button class="btn" type="submit">Profili kaydet</button></form></details>`;
  }

  function mount(element, profile, ports) {
    if (element) { element.innerHTML = render(profile, ports); bind(element,ports); }
  }

  return Object.freeze({ render, mount, bind });
})();
