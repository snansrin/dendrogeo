/* Citation and machine-readable report identity; no publication effects. */
export function createReportCitationPresentation({citeName, siteOrigin: SITE_ORIGIN}) {
  return function renderCitation({snap, P, id, hash, verTxt, doi, L, dataYear}) {
  /* ---- Atıf ---- */
  const citeTitle = snap.study?.title || `${P.name} ağaç envanteri ve karbon stoku raporu`;
  /* Yazar bloğu (0012): yayını isteyen kullanıcı YAZARDIR; kurucular ayrıca
   * beyan edilir (DataCite: creators ≠ contributors). */
  const AU = snap.author || {};
  const authorCite = citeName(AU.name);
  const authorPlain = authorCite || 'DendroGeo';
  const citePlain = `${authorPlain} (${snap.generated_at.slice(0, 4)}). ${citeTitle}. DendroGeo Bilimsel Analiz Raporu, ${id} (sürüm ${verTxt}). DendroGeo. ${doi ? 'https://doi.org/' + doi : SITE_ORIGIN + '/rapor/' + id + '/'}`;
  const bib = `@techreport{${id.toLowerCase().replace(/-/g, '')},
  author    = {${AU.name ? citeName(AU.name) : 'DendroGeo (kurumsal yazar)'}},
  contributor = {Şirin, Nagihan and Şirin, Sinan},
  title     = {${citeTitle}},
  year      = {${snap.generated_at.slice(0, 4)}},
  number    = {${id}},
  version   = {${verTxt}},
  publisher = {DendroGeo},
  url       = {${SITE_ORIGIN}/rapor/${id}/},
  ${doi ? 'doi       = {' + doi + '},\n  ' : ''}note      = {sha256:${hash.slice(0, 16)}…}
}`;

  /* ---- Makine okur üst veri (DataCite Schema 4.7 desenine yakın; §11 + metadata.json) ---- */
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: snap.study?.title || `${P.name}: Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku`,
    alternateName: id,
    reportNumber: id,
    inLanguage: 'tr',
    datePublished: snap.generated_at.slice(0, 10),
    version: verTxt,
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    author: AU.name
      ? [{ '@type': 'Person', name: AU.name }]
      : [{ '@type': 'Organization', name: 'DendroGeo' }],
    contributor: [{ '@type': 'Person', familyName: 'Şirin', givenName: 'Nagihan' }, { '@type': 'Person', familyName: 'Şirin', givenName: 'Sinan' }],
    publisher: { '@type': 'Organization', name: 'DendroGeo', url: SITE_ORIGIN },
    url: `${SITE_ORIGIN}/rapor/${id}/`,
    spatialCoverage: { '@type': 'Place', name: `${P.city}, ${P.country}` },
    temporalCoverage: String(dataYear),
    identifier: doi ? { '@type': 'PropertyValue', propertyID: 'DOI', value: doi } : id,
    citation: [...(L ? ['https://doi.org/10.5281/zenodo.7254221'] : []), 'https://doi.org/10.1111/gcb.12629'],
  };

    return {AU, citePlain, bib, jsonld};
  };
}
