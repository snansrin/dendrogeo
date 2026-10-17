/* Shared presentation assets for public documents; published DGR artifacts stay immutable. */
export function publicPageThemeHead(prefix='..') {
  return `<!-- dg-public-theme -->
<link rel="stylesheet" href="${prefix}/css/style.css">
<link rel="stylesheet" href="${prefix}/css/ui-standard.css">
<script src="${prefix}/src/domain/settings/appearance-policy.js"></script>
<script src="${prefix}/src/adapters/settings/appearance-preference.js"></script>
<script src="${prefix}/src/ui/appearance.js"></script>
<script src="${prefix}/assets/public-pages/appearance.js" defer></script>
<link rel="stylesheet" href="${prefix}/css/appearance.css">
<link rel="stylesheet" href="${prefix}/assets/public-pages/style.css">
<!-- /dg-public-theme -->`;
}
export function applyPublicPageTheme(html,prefix='..') {
  html=html.replace(/<!-- dg-public-theme -->[\s\S]*?<!-- \/dg-public-theme -->\s*/g,'');
  const legacy=html.indexOf('<!-- dg-public-theme -->');
  if(legacy>=0)html=html.slice(0,legacy)+html.slice(html.indexOf('</head>',legacy));
  html=html.replace(/<link\b[^>]*href=["'][^"']*\bcss\/(?:style|ui-standard)\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,'');
  return html.replace('</head>',publicPageThemeHead(prefix)+'\n</head>');
}
