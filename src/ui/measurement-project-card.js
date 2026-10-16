"use strict";

/* Project card markup with role, park binding, location, and existing actions. */
window.DG_MEASUREMENT_PROJECT_CARD={
  render(project,isShared,ui){
    const park=project.parks&&project.parks.name?project.parks.name:(project.park_name||"Park bağlantısı yok");
    const area=project.parks&&project.parks.area_m2?ui.formatArea(project.parks.area_m2):"";
    const location=[project.city,project.country].filter(Boolean).map(ui.escape).join(" · ")||"Konum belirtilmedi";
    const date=project.created_at?new Date(project.created_at).toLocaleDateString(typeof document!=="undefined"&&document.documentElement.lang==="en"?"en-GB":"tr-TR"):"—";
    const role=isShared?'<span class="badge admin">ORTAK</span>':'<span class="badge on">PROJE SAHİBİ</span>';
    const parkState=project.park_id
      ? `<span>🌳 <span translate="no">${ui.escape(park)}</span>${area?" · "+area:""}</span>`
      : `<span class="project-warning">⛔ park yok</span><small>${ui.isAdmin()?"Yönetici olarak bu eski projeyi parka bağlayabilirsin.":"🔐 yönetici bağlayacak"}</small>`;
    const projectId=Number(project.id);
    const reportButton=project.park_id?`<button type="button" class="btn sm ghost" data-project-action="publish" data-project-id="${projectId}">📄 Rapor</button>`:"";
    const linkButton=!isShared&&!project.park_id&&ui.isAdmin()?`<button type="button" class="btn sm ghost" data-project-action="startParkScan" data-project-id="${projectId}">🌳 Parka bağla</button>`:"";
    const primary=`<button type="button" class="btn sm" data-project-action="openMeasure" data-project-id="${projectId}">📏 Ölçüme geç</button>`;
    const management=isShared
      ? '<p class="project-access-note">Düzenleme ve ekip yönetimi proje sahibinde</p>'
      : `<div class="project-card-actions">${reportButton}${linkButton}<button type="button" class="btn sm ghost" data-project-action="edit" data-project-id="${projectId}">✏️ Düzenle</button><button type="button" class="btn sm ghost project-danger" data-project-action="delete" data-project-id="${projectId}">🗑 Sil</button></div>`;
    return `<article class="project-card ${isShared?"is-shared":"is-owned"}"><div class="project-card-top"><div><div class="project-card-park">${parkState}</div><h4 translate="no">${ui.escape(project.name||("Project #"+project.id))}</h4></div>${role}</div><div class="project-card-actions project-card-primary">${primary}<span class="project-card-location">📍 ${location}</span></div><details class="project-card-details"><summary>Proje bilgileri ve işlemler</summary><div class="project-card-detail-body"><dl class="project-card-meta"><div><dt>Oluşturulma tarihi</dt><dd>${date}</dd></div><div><dt>Proje kimliği</dt><dd class="mono">#${projectId}</dd></div></dl>${management}</div></details></article>`;
  }
};
