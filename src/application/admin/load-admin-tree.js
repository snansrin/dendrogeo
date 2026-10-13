"use strict";
(function(root){
 async function execute(ports){
  if(!ports.authorized())return;
  const box=ports.getBox();
  if(box&&!ports.hasTree(box))ports.showLoading(box);
  const scroll=ports.keepScroll();
  let result;
  try{
   result=await ports.fetch();
  }catch(error){
   ports.setRows([]);
   ports.setError(ports.queryError(error));
   ports.draw();
   ports.restoreScroll(scroll);
   return;
  }
  const rows=result.rows||[];
  ports.setRows(rows);
  ports.setError(result.error&&rows.length?null:result.error);
  if(result.mode!=="embed"&&result.error&&rows.length)ports.warnFallback(result.error);
  try{
   ports.draw();
  }catch(error){
   const message=ports.renderError(error);
   ports.setError(message);
   ports.showRenderError(box,message);
  }
  ports.restoreScroll(scroll);
  return result;
 }
 root.DG_LOAD_ADMIN_TREE=Object.freeze({execute});
})(window);
