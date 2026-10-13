"use strict";

/* Project card markup with role, park binding, location, and existing actions. */
window.DG_MEASUREMENT_PROJECT_CARD={
  render(project,isShared,ui){
    const park=project.parks&&project.parks.name?project.parks.name:(project.park_name||"Park bağlantısı yok");
    const area=project.parks&&project.parks.area_m2?ui.formatArea(project.parks.area_m2):"";
    const location=[project.city,project.country].filter(Boolean).map(ui.escape).join(" · ")||"Konum belirtilmedi";
    const date=project.created_at?new Date(project.created_at).toLocaleDateString("tr-TR"):"—";
    const role=isShared?'<span class="badge admin">ORTAK</span>':'<span class="badge on">PROJE SAHİBİ</span>';
    const parkState=project.park_id
      ? `<span>🌳 ${ui.escape(park)}${area?" · "+area:""}</span>`
      : `<span class="project-warning">⛔ park yok</span><small>${ui.isAdmin()?"Yönetici olarak bu eski projeyi parka bağlayabilirsin.":"🔐 yönetici bağlayacak"}</small>`;
    const reportButton=project.park_id?`<button class="btn sm ghost" onclick="dgUserPubOpen(${project.id})">📄 Rapor</button>`:"";
    const linkButton=!isShared&&!project.park_id&&ui.isAdmin()?`<button class="btn sm ghost" onclick="startParkScan({projectId:${project.id},returnTo:'projects'})">🌳 Parka bağla</button>`:"";
    const actions=isShared
      ? `<button class="btn sm" onclick="dgProjectOpenMeasure(${project.id})">📏 Ölçüme geç</button><span class="project-access-note">Düzenleme ve ekip yönetimi proje sahibinde</span>`
      : `<button class="btn sm" onclick="dgProjectOpenMeasure(${project.id})">📏 Ölçüm</button>${reportButton}${linkButton}<button class="btn sm ghost" onclick="editProject(${project.id})">✏️ Düzenle</button><button class="btn sm ghost project-danger" onclick="deleteProject(${project.id})">🗑 Sil</button>`;
    return `<article class="project-card ${isShared?"is-shared":"is-owned"}"><div class="project-card-top"><div><div class="project-card-park">${parkState}</div><h4>${ui.escape(project.name||("Proje #"+project.id))}</h4></div>${role}</div><div class="project-card-meta"><span>📍 ${location}</span><span>📅 ${date}</span><span class="mono">#${project.id}</span></div><div class="project-card-actions">${actions}</div></article>`;
  }
};
