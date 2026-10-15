"use strict";
(function(root){
 async function execute(userId,ports){
  let result;
  try{result=await ports.load(userId);}catch(error){const element=ports.container();if(element)element.innerHTML=ports.failed?ports.failed(error):ports.empty();return false;}
  const{data,error}=result||{};
  if(error){const element=ports.container();if(element)element.innerHTML=ports.failed?ports.failed(error):ports.empty();return false;}
  const groups=ports.group(data||[]),entries=Array.isArray(groups)?groups:Array.from(groups?.entries?.()||[]),element=ports.container();if(!element)return;
  element.innerHTML=entries.length?entries.map(([name,rows])=>ports.renderGroup(name,rows)).join(""):ports.empty();
  ports.afterRender?.(element);
  return true;
 }
 root.DG_LOAD_OWN_RECORDS_VIEW=Object.freeze({execute});
})(window);
