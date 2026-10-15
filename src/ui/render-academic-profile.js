"use strict";

window.DG_RENDER_ACADEMIC_PROFILE = (() => {
  function render(profile, ports) {
    const initials = profile.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('');
    const orcid = profile.values.orcid && ports.orcidValid(profile.values.orcid)
      ? `<p class="dg-profile-orcid"><a href="https://orcid.org/${ports.escape(profile.values.orcid)}" target="_blank" rel="noopener" aria-label="ORCID kaydını aç">ORCID · ${ports.escape(profile.values.orcid)}</a><small>Kaydedilmiş kimlik · ORCID hesabıyla doğrulanmamış</small></p>` : '';
    const fields = profile.fields.map(([key, label]) => ports.input(key, label, profile.values[key])).join('');
    return `<div class="dg-profile-heading"><span class="dg-profile-avatar" aria-hidden="true">${ports.escape(initials)}</span><div><div class="dg-kicker">ARAŞTIRMACI PROFİLİ</div><h2>Merhaba, ${ports.escape(profile.name)}</h2><p class="dg-meta">${ports.escape([profile.values.institution, profile.values.department].filter(Boolean).join(' · ') || 'Saha çalışmalarınız ve akademik bilgileriniz bir arada.')}</p></div></div>${orcid}<p id="dgAcademicSavedStatus" class="dg-meta" role="status"></p><div class="dg-profile-actions"><button class="btn sm" onclick="go('measure')">🌳 Yeni ölçüm</button><button class="btn sm blue" onclick="go('projects')">📁 Projelerim</button><a class="btn sm ghost" href="rapor/" target="_blank" rel="noopener">📄 Yayınlar</a></div><details><summary>Akademik bilgilerimi düzenle</summary><p class="dg-meta">Bu bilgiler hesabınızda saklanır. Rapor yayımlarken hangi bilgilerin herkese açılacağını ayrıca kontrol edersiniz.</p><form id="dgAcademicProfileForm" onsubmit="dgAcademicProfileSave(event)"><div class="dg-academic-grid">${fields}</div><p id="dgAcademicProfileStatus" class="dg-meta" role="status"></p><button class="btn" type="submit">Profili kaydet</button></form></details>`;
  }

  function mount(element, profile, ports) {
    if (element) element.innerHTML = render(profile, ports);
  }

  return Object.freeze({ render, mount });
})();
