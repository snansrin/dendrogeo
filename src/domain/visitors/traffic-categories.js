(function(root){
 'use strict';
 const pages={'/':'home','/index.html':'home','/en/':'home-en','/agac-envanteri/':'inventory','/karbon-hesaplama/':'carbon','/arazi-ortusu/':'landcover','/kent-parklari/':'parks','/yontem/':'methods','/en/methods/':'methods-en','/veri/':'data','/rapor/':'reports','/hakkimizda/':'about','/gizlilik/':'privacy','/aydinlatma/':'notice','/kullanim-kosullari/':'terms','/kunye/':'contact'};
 function page(path){return pages[path]||null;}
 function source(referrer,origin){
  let host;try{const url=new URL(referrer);if(url.origin===origin)return'internal';host=url.hostname.toLowerCase().replace(/^www\./,'');}catch{return'direct';}
  const matches=domains=>domains.some(domain=>host===domain||host.endsWith('.'+domain));
  if(matches(['chatgpt.com','chat.openai.com','perplexity.ai','claude.ai','copilot.microsoft.com','gemini.google.com']))return'ai';
  if(matches(['t.me','telegram.org','telegram.me']))return'telegram';
  if(/(^|\.)(google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})|bing\.com|yahoo\.(?:com|[a-z]{2}|co\.[a-z]{2})|duckduckgo\.com|yandex\.(?:com|ru|com\.tr)|baidu\.com)$/.test(host))return'search';
  if(matches(['facebook.com','instagram.com','linkedin.com','x.com','twitter.com','t.co','youtube.com','reddit.com']))return'social';
  return'referral';
 }
 function device(userAgent,touchPoints=0){if(/iPad|Tablet|PlayBook|Silk/i.test(userAgent)||(/Android/i.test(userAgent)&&!/Mobile/i.test(userAgent))||(/Macintosh/i.test(userAgent)&&touchPoints>1))return'tablet';if(/Mobi|iPhone|Android/i.test(userAgent))return'phone';return'desktop';}
 root.DG_TRAFFIC_CATEGORIES=Object.freeze({page,source,device});
})(window);
