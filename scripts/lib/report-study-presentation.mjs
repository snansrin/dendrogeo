/* Render declared academic study context without changing the snapshot. */
export function createReportStudyPresentation({esc}) {
  return function renderStudy(snap) {
    return `${snap.study ? `<div class="meta" aria-label="Akademik çalışma künyesi">${Object.entries({project_name:'Proje',study_type:'Çalışma türü',institution:'Üniversite / kurum',department:'Fakülte / bölüm',program:'Program / çalışma alanı',advisor:'Danışman',orcid:'ORCID',funding:'Destek / proje numarası',start_date:'Beyan edilen saha başlangıcı',end_date:'Beyan edilen saha bitişi'}).filter(([k])=>snap.study[k]).map(([k,l])=>`<div${k==='project_name'?' class="meta-wide"':''}><b>${esc(l)}</b><code>${esc(snap.study[k])}</code></div>`).join('')}${snap.study.independent ? '<div><b>Kurumsal bağ</b><code>Bağımsız çalışma</code></div>' : ''}</div><p><b>Çalışmanın amacı ve kapsamı.</b> ${esc(snap.study.purpose)}</p>${snap.study.sampling ? '<p><b>Örnekleme tasarımı.</b> '+esc(snap.study.sampling)+'</p>' : ''}${snap.study.instruments ? '<p><b>Saha yöntemi ve ölçüm cihazları.</b> '+esc(snap.study.instruments)+'</p>' : ''}` : ''}`;
  };
}
