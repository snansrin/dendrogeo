/* Render declared academic study context without changing the snapshot. */
export function createReportStudyPresentation({esc}) {
  return function renderStudy(snap) {
    if(!snap.study)return '';
    const study=snap.study;
    const metadata=Object.entries({project_name:'Proje',study_type:'Çalışma türü',institution:'Üniversite / kurum',department:'Fakülte / bölüm',program:'Program / çalışma alanı',advisor:'Danışman',orcid:'ORCID',funding:'Destek / proje numarası',start_date:'Beyan edilen saha başlangıcı',end_date:'Beyan edilen saha bitişi'}).filter(([key])=>study[key]).map(([key,label])=>`<div${key==='project_name'?' class="meta-wide"':''}><b>${esc(label)}</b><code>${esc(study[key])}</code></div>`).join('')+(study.independent?'<div><b>Kurumsal bağ</b><code>Bağımsız çalışma</code></div>':'');
    return (metadata?`<div class="meta" aria-label="Akademik çalışma künyesi">${metadata}</div>`:'')+
      (study.inventory_scope?`<p><b>Envanter kapsamı (araştırmacı beyanı).</b> ${esc({census:'Tam sayım',partial:'Kısmi envanter',probability_sample:'Olasılıklı örnekleme'}[study.inventory_scope]||'Belirtilmedi')}</p>`:'')+
      [['purpose','Çalışmanın amacı ve kapsamı.'],['sampling','Örnekleme tasarımı.'],['instruments','Saha yöntemi ve ölçüm cihazları.'],['observers','Ölçümü yapan kişi / ekip.'],['calibration','Cihaz kontrolü ve kalibrasyon.'],['repeat_measurements','Tekrar ölçüm ve bağımsız kontrol.']].filter(([key])=>study[key]).map(([key,label])=>`<p><b>${label}</b> ${esc(study[key])}</p>`).join('');
  };
}
