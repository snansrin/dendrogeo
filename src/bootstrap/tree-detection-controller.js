"use strict";
/* Composition: isolated candidate layers never write into surface or inventory stores. */
(function(root){
 const host=document.getElementById('treeDetectionPanel');if(!host||host.tagName!=='DETAILS')return;
 let controller=null;
 function title(){const node=host.querySelector('[data-tree-title]');if(node)node.textContent=typeof DG_LANG!=='undefined'&&DG_LANG==='en'?'🌳 Tree Detection':'🌳 Ağaç Algılama';}
 title();root.addEventListener('dg:lang',title);
 host.addEventListener('toggle',()=>{
  if(!host.open||controller)return;
  const layer=root.DG_PARK_TREE_CANDIDATE_LAYER.create({getMap:()=>typeof map==='undefined'?null:map,leaflet:L});
  const imagery=root.DG_PARK_TREE_IMAGERY.create({fetch:root.fetch.bind(root)});
  const view=root.DG_TREE_DETECTION_PANEL.create({host,english:()=>typeof DG_LANG!=='undefined'&&DG_LANG==='en',focus:layer.focus,download:result=>{
   const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='dendrogeo-park-tree-candidates.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }});
  controller=root.DG_DETECT_TREE_CANDIDATES.create({getPark:()=>typeof PARK_POLY==='undefined'||!PARK_POLY?null:{outer:PARK_POLY,inner:typeof PARK_HOLES==='undefined'?[]:PARK_HOLES},plan:root.DG_PARK_TREE_SCAN_PLAN.plan,readImage:imagery.read,clearImages:imagery.clear,infer:root.DG_TREE_DETECTION_CLIENT.create({client:sb,url:SB_URL,publicKey:SB_KEY,fetch:root.fetch.bind(root)}),collect:root.DG_PARK_TREE_SCAN_RESULTS.collect,summarize:root.DG_PARK_TREE_SCAN_RESULTS.summarize,present:value=>{view.present(value);layer.show(value.result);},makeAbortController:()=>new AbortController(),clock:()=>new Date().toISOString(),yieldFrame:()=>new Promise(resolve=>requestAnimationFrame(resolve))});
  view.bind(controller);root.addEventListener('dg:lang',view.refresh);
  let account;sb.auth.onAuthStateChange((_event,session)=>{const next=session?.user?.id||null;if(account!==undefined&&account!==next)controller.clear();account=next;});
  new MutationObserver(()=>controller.contextChanged()).observe(document.getElementById('parkInfo'),{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
 });
})(window);
