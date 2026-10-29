/* Search entry points only. Supporting documents remain public and crawlable. */
export const SITE_ORIGIN='https://dendrogeo.org';
export const INDEXABLE_PATHS=Object.freeze(['/','/en/']);
export const PUBLIC_DOCUMENT_PATHS=Object.freeze([
 '/','/en/','/agac-envanteri/','/karbon-hesaplama/','/arazi-ortusu/',
 '/kent-parklari/','/yontem/','/veri/','/hakkimizda/','/gizlilik/',
 '/kullanim-kosullari/','/aydinlatma/','/kunye/','/en/methods/',
 '/en/privacy/','/en/data-protection/','/en/terms/','/rapor/'
]);
export function applyIndexingPolicy(html,pathname){
 const value=INDEXABLE_PATHS.includes(pathname)
  ?'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  :'noindex, follow';
 const meta='<meta name="robots" content="'+value+'">';
 return html.replace(/<meta\b(?=[^>]*\bname=["'](?:robots|googlebot|bingbot)["'])[^>]*>\s*/gi,'')
  .replace('</head>',meta+'\n</head>');
}
export function landingOnlySitemap(xml){
 return xml.replace(/[ \t]*<url>[\s\S]*?<\/url>\r?\n?/g,block=>{
  const loc=block.match(/<loc>([^<]+)<\/loc>/)?.[1];
  return INDEXABLE_PATHS.some(path=>loc===SITE_ORIGIN+path)?block:'';
 });
}
