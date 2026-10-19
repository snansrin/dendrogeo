(function(root){
 'use strict';
 let generation=0,pending=null,pendingDays=null;
 const allowed=()=>typeof PROFILE!=='undefined'&&PROFILE?.role==='owner';
 function load(){
  if(!allowed())return Promise.resolve();const box=root.document.getElementById('visAnalytics');if(!box)return Promise.resolve();
  const selector=root.document.getElementById('visAnalyticsDays'),days=Number(selector?.value||1),T=value=>typeof dgCf==='function'?dgCf(value):value;
  if(pending&&pendingDays===days)return pending;const token=++generation;pendingDays=days;box.setAttribute('aria-busy','true');
  pending=(async()=>{try{const data=await root.DG_AGGREGATE_METRICS_STORE.load(sb,days);if(token!==generation||!allowed())return;
   root.DG_VISITOR_ANALYTICS_UI.render(box,data,{translate:T,locale:typeof DG_LANG!=='undefined'&&DG_LANG==='en'?'en-GB':'tr-TR'});
  }catch{if(token===generation&&allowed())box.textContent=T('Kullanım özeti alınamadı. Yenile ile tekrar deneyin.');}
  finally{if(token===generation){box.setAttribute('aria-busy','false');pending=null;pendingDays=null;}}})();return pending;
 }
 root.document.addEventListener('change',event=>{if(event.target?.id==='visAnalyticsDays')void load();});
 root.DG_VISITOR_ANALYTICS_PANEL=Object.freeze({load});
})(window);
