/* Pure machine-readable report metadata assembly.
 *
 * Production reads/constants stay with make-report.mjs and are supplied as
 * explicit dependencies so this module cannot access the filesystem, network,
 * snapshot storage, or mutable global state.
 */
export function createReportMetadata(snap, { id, hash, version = '1.0', meta = null, history = null }, policy) {
  const {
    datasetDefault,
    siteOrigin,
    reportTitle,
    epsgLabel,
    trNum,
    legalStatusScope,
    qaLimits,
    qaState,
  } = policy;
  const M = Object.assign({}, snap.provenance || {}, meta || {});
  const L = (snap.lulc && !snap.lulc.error) ? snap.lulc : null;
  const P = snap.park, t = snap.totals;
  const doi = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(String(M.doi || '')) ? String(M.doi) : null;
  const resolutionLabel = L?.review ? "Uydu 10/20 m + vektör sınır" : L?.accepted ? "Kayıtlı alan toplamları" : "10 m";
  const dataset = (L && L.source) || datasetDefault;
  const related = [
    ...(L ? [{ relationType: 'IsDerivedFrom', relatedIdentifier: '10.5281/zenodo.7254221', relatedIdentifierType: 'DOI', resourceType: 'Dataset', label: 'ESA WorldCover 10 m 2021 v200 (temel arazi örtüsü ürünü)' }] : []),
    { relationType: 'IsDerivedFrom', relatedIdentifier: 'https://www.openstreetmap.org/copyright', relatedIdentifierType: 'URL', resourceType: 'Dataset', label: 'OpenStreetMap (park sınırı geometrisi + bütünleyici doğrulama)' },
    { relationType: 'IsDerivedFrom', relatedIdentifier: '10.1111/gcb.12629', relatedIdentifierType: 'DOI', resourceType: 'Other', label: 'Chave ve ark. (2014) allometrik modeli' },
  ];
  if (doi) related.push({ relationType: 'IsIdenticalTo', relatedIdentifier: doi, relatedIdentifierType: 'DOI', resourceType: 'Report' });
  if (M.git_commit) related.push({ relationType: 'IsSupplementedBy', relatedIdentifier: 'https://github.com/snansrin/dendrogeo/commit/' + M.git_commit, relatedIdentifierType: 'URL', resourceType: 'Software', label: 'Analiz kodu ve sürümü' });
  for (const h of history || []) related.push({ relationType: 'IsNewVersionOf', relatedIdentifier: h.id, relatedIdentifierType: 'Other', resourceType: 'Report', label: h.note || 'Aynı parkın önceki analizi' });
  return {
    schema: 'dendrogeo-report-metadata/1',
    publicationStage: 'production',
    reportStandard: 'DendroGeo Academic Report 3.0',
    dataciteCompatibility: 'DataCite Metadata Schema 4.7 alan adlarıyla hizalıdır; DOI kaydı bu nesneden türetilir.',
    identifier: id,
    identifierType: 'DGR',
    identifierDescription: reportTitle + ' (iç/alan kimliği)',
    title: snap.study?.title || `${P.name} (${P.city}): Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku Analizi`,
    study: snap.study || null,
    publicationYear: Number(snap.generated_at.slice(0, 4)),
    resourceType: 'Scientific Analysis Report',
    resourceTypeGeneral: 'Report',
    publisher: 'DendroGeo',
    version: String(version),
    language: 'tr',
    license: 'CC-BY-NC-4.0',
    creators: (snap.author && snap.author.name)
      ? [{ name: snap.author.name, nameType: 'Personal', ...(snap.study?.institution ? {affiliation:[{name:snap.study.institution}]} : {}), ...(snap.study?.orcid ? {nameIdentifiers:[{nameIdentifier:'https://orcid.org/'+snap.study.orcid,nameIdentifierScheme:'ORCID',schemeURI:'https://orcid.org'}]} : {}) }]
      : [{ name: 'DendroGeo', nameType: 'Organizational' }],
    creatorsNote: (snap.author && snap.author.name)
      ? 'Rapor, yayını isteyen kullanıcının (veri katkısı sahibinin) adıyla yayımlanır.'
      : 'Bireysel yazar bilgisi bulunmadığından kurumsal yazarlık kullanılmıştır.',
    contributors: [...(snap.study?.advisor ? [{name:snap.study.advisor,nameType:'Personal',contributorType:'Supervisor'}] : []), { name: 'Şirin, Nagihan', contributorType: 'Founder', nameType: 'Personal' }, { name: 'Şirin, Sinan', contributorType: 'Founder', nameType: 'Personal' }],
    subjects: [{ subject: 'tree inventory' }, { subject: 'carbon stock' }, { subject: 'land cover' }, { subject: 'urban forestry' }],
    spatialCoverage: `${P.city}, ${P.country}`,
    temporalCoverage: String((L && L.year) || 2021),
    measurementPeriod: `${snap.period.from.slice(0, 10)}/${snap.period.to.slice(0, 10)}`,
    resolution: L?.review ? 'Uydu 10/20 m + vektör sınır' : '10 m',
    methodVersion: `${M.engine || 'DendroGeo LC Engine'}${M.engine_version ? ' ' + M.engine_version : ''}`.trim(),
    projection: epsgLabel((L && L.epsg) || M.epsg || null),
    sampleSize: t.n,
    variables: [
      { name: 'Göğüs çevresi (C)', description: 'Mezura ile 1,30 m yükseklikte ölçülen ham gövde çevresi (girth_cm)', unit: 'cm' },
      { name: 'DBH (D)', description: 'Türetilmiş göğüs çapı: D = C / pi (dbh_cm)', unit: 'cm' },
      { name: 'Boy (H)', description: 'Ağaç boyu', unit: 'm' },
      { name: 'rho', description: 'Odun yoğunluğu (tür bazlı; bulunamazsa grup varsayılanı)', unit: 'g/cm3' },
      { name: 'AGB', description: 'Toprak üstü biyokütle', unit: 'kg' },
      { name: 'BGB', description: 'Toprak altı (kök) biyokütlesi = AGB x 0,26', unit: 'kg' },
      { name: 'Karbon', description: 'Tahmini karbon stoku = (AGB + BGB) x 0,47', unit: 'kg C' },
      { name: 'h/DBH', description: 'Boy/çap oranı — yalnız inceleme göstergesi, hata hükmü değildir', unit: 'birimsiz' },
    ],
    measurementNote: 'Sahada 1,30 m yükseklikte göğüs çevresi (cm) mezura ile ölçülür ve girth_cm alanında korunur. DBH çapı D = C / pi ile türetilip dbh_cm alanına yazılır; karbon ve hacim hesabında yalnız türetilmiş DBH kullanılır.'
      + ((snap.qa && snap.qa.species && snap.qa.species.dbh_stats)
        ? ` Türetilmiş DBH aralığı ${trNum(snap.qa.species.dbh_stats.min, 1)}–${trNum(snap.qa.species.dbh_stats.max, 1)} cm (medyan ${trNum(snap.qa.species.dbh_stats.medyan, 1)} cm, n=${snap.qa.species.dbh_stats.n}); ham çevre değerleri ayrıca korunmuştur.`
        : ''),
    scopeNote: legalStatusScope,
    carbonRecalc: (snap.qa && snap.qa.species && snap.qa.species.dev_rho) ? {
      bandPct: qaLimits.CARBON_DEV_PCT,
      minAbsDiffKg: qaLimits.CARBON_DEV_MIN_KG,
      checked: snap.qa.species.dev_rho.n,
      matchedSpeciesRho: snap.qa.species.dev_rho.tur,
      matchedGroupRho: snap.qa.species.dev_rho.grup,
      matchedGroupOnlyPoints: [],
      outOfBand: (snap.qa.species.dev_fail || []).map((x) => x.point_id),
      densityLockId: 'DG-WD-LOCK-2026-10-06-FINAL',
      note: 'Beklenen değer yalnız FINAL kilitli ρ tablosuyla hesaplanır: kilitli tür satırı varsa o, yoksa türün kendi İBRELİ/YAPRAKLI grup geneli kullanılır. Alternatif veya tarihsel ρ kabul edilmez.',
    } : null,
    qaInfo: (snap.qa && snap.qa.species && snap.qa.species.info) || [],
    sources: [dataset, 'OpenStreetMap (ODbL)', 'DendroGeo saha ölçümleri (moderatör onaylı)'],
    relatedIdentifiers: related,
    qaState: (snap.qa && snap.qa.species && snap.qa.species.state) || qaState.VALID,
    qaStateLabel: { [qaState.BLOCKED]: '🔴 BLOKLU', [qaState.REVIEW]: '🟡 İNCELEME', [qaState.VALID]: '🟢 GEÇERLİ' }[((snap.qa && snap.qa.species && snap.qa.species.state) || qaState.VALID)],
    resultHash: 'sha256:' + hash,
    gitCommit: M.git_commit || null,
    generated: snap.generated_at,
    url: siteOrigin + '/rapor/' + id + '/',
    doi,
    doiNote: doi ? 'Raporun dış kalıcı kimliği.' : 'DOI atanmadı; DGR raporun yerel kimliğidir.',
    history: [
      ...(history || []).map((h) => ({ id: h.id, version: '1.0', date: h.date || null, status: h.retracted ? 'Geri çekildi' : 'Yerine bu rapor yayımlandı', note: h.note || '' })),
      { id, version: String(version), date: snap.generated_at.slice(0, 10), status: 'Geçerli', note: 'İlk yayımlama' },
    ],
  };
}
