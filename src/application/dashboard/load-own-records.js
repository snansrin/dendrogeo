"use strict";
(function(root){
 async function execute(userId,ports){
  let result;
  try{result=await ports.load(userId);}catch(error){const element=ports.container();if(element)element.innerHTML=ports.failed?ports.failed(error):ports.empty();return false;}
  const{data,error}=result||{};
  if(error){const element=ports.container();if(element)element.innerHTML=ports.failed?ports.failed(error):ports.empty();return false;}
  const groups=ports.group(data||[]),element=ports.container();if(!element)return;
  element.innerHTML=groups.size?[...groups.entries()].map(([name,rows])=>ports.renderGroup(name,rows)).join(""):ports.empty();
  return true;
 }
 root.DG_LOAD_OWN_RECORDS_VIEW=Object.freeze({execute});
})(window);
