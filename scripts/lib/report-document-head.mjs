import {scriptSafeJson} from './script-safe-json.mjs';
/* Render report document and sharing metadata with existing formatters. */
export function createReportDocumentHead({esc, fmtT, reportStyles, siteOrigin: SITE_ORIGIN}) {
  return function renderHead({id, P, t, dataset, ciTxt, hash, L, jsonld}) {
    return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>${id} · ${esc(P.name)} — Ağaç Envanteri ve Karbon Stoku Raporu</title>
<meta name="description" content="${esc(P.name)} (${esc(P.city)}) bireysel ağaç envanteri: ${t.n} onaylı ölçüm, toplam karbon ${fmtT(t.ci.mean)} t (%95 GA ${fmtT(t.ci.lo)}–${fmtT(t.ci.hi)}). Yöntem: Chave ve ark. 2014; Monte Carlo belirsizlik; konum çiti doğrulaması; ${esc(dataset)} arazi örtüsü bağlamı.">
<link rel="canonical" href="${SITE_ORIGIN}/rapor/${id}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="DendroGeo">
<meta property="og:title" content="${id} · ${esc(P.name)} Karbon Stoku Raporu">
<meta property="og:description" content="${t.n} onaylı ölçüm · toplam ${ciTxt} · sha256:${hash.slice(0, 12)}…">
<meta property="og:url" content="${SITE_ORIGIN}/rapor/${id}/">
${L ? '<meta property="og:image" content="' + SITE_ORIGIN + '/rapor/' + id + '/harita.png">' : ''}
<meta name="twitter:card" content="${L ? 'summary_large_image' : 'summary'}">
<link rel="alternate" hreflang="tr" href="${SITE_ORIGIN}/rapor/${id}/">
<link rel="alternate" type="application/json" href="metadata.json" title="Rapor üst verisi (DataCite deseni)">
<script type="application/ld+json">${scriptSafeJson(jsonld)}</script>
<style>${reportStyles(id)}</style>`;
  };
}
