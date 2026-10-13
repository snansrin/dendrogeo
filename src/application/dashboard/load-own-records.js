"use strict";
(function(root){
 async function execute(userId,ports){
  const{data}=await ports.load(userId);
  const groups=ports.group(data||[]),element=ports.container();if(!element)return;
  element.innerHTML=groups.size?[...groups.entries()].map(([name,rows])=>ports.renderGroup(name,rows)).join(""):ports.empty();
 }
 root.DG_LOAD_OWN_RECORDS_VIEW=Object.freeze({execute});
})(window);
