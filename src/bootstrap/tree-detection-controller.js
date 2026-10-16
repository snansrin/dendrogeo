"use strict";
/* Composition only: image candidates have no route into accepted scientific records. */
(function(root){
 const host=document.getElementById('treeDetectionPanel');if(!host||host.tagName!=='DETAILS')return;
 let controller=null;
 function title(){const node=host.querySelector('[data-tree-title]');if(node)node.textContent=typeof DG_LANG!=='undefined'&&DG_LANG==='en'?'🌳 Tree Detection':'🌳 Ağaç Algılama';}
 title();root.addEventListener('dg:lang',title);
 host.addEventListener('toggle',()=>{
  if(!host.open||controller)return;
  const view=root.DG_TREE_DETECTION_PANEL.create({host,english:()=>typeof DG_LANG!=='undefined'&&DG_LANG==='en',download:result=>{
   const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download='dendrogeo-tree-candidates.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }});
  controller=root.DG_DETECT_TREE_CANDIDATES.create({prepare:root.DG_TREE_DETECTION_CLIENT.prepare,infer:root.DG_TREE_DETECTION_CLIENT.create({client:sb,url:SB_URL,publicKey:SB_KEY,fetch:root.fetch.bind(root)}),normalize:root.DG_TREE_DETECTION_RESULTS.build,present:view.present,makeAbortController:()=>new AbortController()});
  view.bind(controller);
  root.addEventListener('dg:lang',view.refresh);
  let account;
  sb.auth.onAuthStateChange((_event,session)=>{const next=session?.user?.id||null;if(account!==undefined&&account!==next)controller.clear();account=next;});
 });
})(window);
