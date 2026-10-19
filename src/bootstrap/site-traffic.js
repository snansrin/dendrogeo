/* First-party daily event totals. No account identity, URL queries, cookies or visitor IDs. */
(function(root){
 'use strict';
 const doc=root.document,categories=root.DG_TRAFFIC_CATEGORIES,config=root.DG_SITE_TRAFFIC_CONFIG;
 const enabled=()=>root.location.hostname==='dendrogeo.org'&&!root.navigator.webdriver&&!root.navigator.globalPrivacyControl&&root.navigator.doNotTrack!=='1'&&root.navigator.onLine!==false;
 const origin='https://dendrogeo.org',source=categories.source(doc.referrer,origin),device=categories.device(root.navigator.userAgent,root.navigator.maxTouchPoints);
 let previousView=null;
 function record(event,page){if(!enabled()||!config||!page)return;void root.DG_SEND_SITE_METRIC.send(config,{event,page,source,device},{fetcher:(...args)=>root.fetch(...args),AbortController:root.AbortController,setTimeout:(...args)=>root.setTimeout(...args),clearTimeout:(...args)=>root.clearTimeout(...args)});}
 function workspace(view){if(!['dash','measure','nav','map','projects','records','export','world'].includes(view)||view===previousView)return;previousView=view;record('workspace_open','app-'+view);}
 function start(){record('page_view',categories.page(root.location.pathname));doc.addEventListener('click',event=>{const button=event.target?.closest?.('[data-park-action="landCoverAnalysis"]');if(button&&!button.disabled)record('analysis_request','app-map');},true);}
 root.DG_SITE_TRAFFIC=Object.freeze({workspace});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
