/* Read-only research disclosures. Never calculates or replaces a report result. */
const numberOrNull=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export function createScientificDisclosure(snap) {
  const study=snap.study||{},mc=snap.mc||{};
  const scope=['census','partial','probability_sample'].includes(study.inventory_scope)?study.inventory_scope:'unknown';
  return {
    schema:'dendrogeo-scientific-disclosure/1',
    sampling:{scope,source:'researcher_declaration',design:study.sampling||null,
      instruments:study.instruments||null,observers:study.observers||null,
      calibration:study.calibration||null,repeatMeasurements:study.repeat_measurements||null,
      inference:'reported_records_only; no design-based park-total inference supplied'},
    missingDeclarations:['inventory_scope','sampling','instruments','observers','calibration','repeat_measurements']
      .filter(key=>key==='inventory_scope'?scope==='unknown':!study[key]),
    uncertainty:{
      measurement:{girthSdCm:numberOrNull(mc.GIRTH_SD_CM),heightSdM:numberOrNull(mc.H_SD_M),
        legacyDiameterSdCm:numberOrNull(mc.DBH_SD_CM),basis:'assumed; not instrument calibration evidence'},
      density:{propagated:false,basis:'fixed locked species/group assignment; no density distribution supplied'},
      model:{cv:numberOrNull(mc.MODEL_CV),correlation:'shared multiplier across records',basis:'assumed; not local validation'},
      sampling:{propagated:false,basis:'no design-based sampling variance supplied'},
      interpretation:'Conditional input/model interval; not a complete uncertainty budget or a park-wide sampling interval',
    },
    localAllometryValidation:'independent local reference evidence not supplied in this report context',
    calculationPolicy:'existing measurement, density, allometry, coefficients and Monte Carlo results are unchanged',
  };
}

export function renderScientificDisclosure(disclosure,{esc}) {
  const u=disclosure.uncertainty,show=(value,unit)=>value==null?'Belirtilmedi':`${value} ${unit}`;
  const measurement=u.measurement;
  const rows=[
    ['Ölçüm',`Çevre SD: ${show(measurement.girthSdCm,'cm')}; boy SD: ${show(measurement.heightSdM,'m')}.`+
      (measurement.legacyDiameterSdCm!=null?` Eski DBH_SD_CM alanı: ${show(measurement.legacyDiameterSdCm,'cm')}; çevre hatası olarak yeniden yorumlanmadı.`:'')+' Bunlar varsayımdır; cihaz kalibrasyonu kanıtı değildir.'],
    ['Odun yoğunluğu','Kilitli tür/grup değeri sabittir. Yoğunluğa ait ayrı bir hata dağılımı mevcut aralığa yayılmamıştır.'],
    ['Model',`CV: ${show(u.model.cv,'')}. Ortak model çarpanı kayıtlar arasında koreledir; yerel model doğruluğunu kanıtlamaz.`],
    ['Örnekleme','Örnekleme tasarımına bağlı varyans mevcut aralığa dahil değildir. Kayıtlı ağaçların toplamı, belgesiz biçimde bütün parka genellenemez.'],
  ];
  const scope={census:'Tam sayım (araştırmacı beyanı)',partial:'Kısmi envanter',probability_sample:'Olasılıklı örnekleme (araştırmacı beyanı)',unknown:'Belirtilmedi'}[disclosure.sampling.scope];
  const missing=disclosure.missingDeclarations.length;
  return `<div class="stmt"><b>Belirsizlik kapsamı ve saha beyanı.</b><p>Envanter kapsamı: ${esc(scope)}. ${missing?`${missing} saha bilgisi alanı belirtilmedi.`:'Saha bilgisi alanları araştırmacı tarafından dolduruldu; bağımsız doğrulama yerine geçmez.'}</p></div>`+
    `<div class="tscroll"><table class="uncertainty"><caption>Belirsizlik kaynakları ve mevcut hesabın kapsamı</caption><thead><tr><th>Kaynak</th><th>Açıklama</th></tr></thead><tbody>${rows.map(([name,note])=>`<tr><th scope="row">${esc(name)}</th><td class="qd">${esc(note)}</td></tr>`).join('')}</tbody></table></div>`+
    '<p>Yerel kent ağaçlarına uygunluk, ayrı bir bağımsız referans çalışmasıyla değerlendirilmelidir. Bu açıklamalar mevcut denklem, yoğunluk, katsayı veya sayısal sonuçları değiştirmez.</p>';
}
