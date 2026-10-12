"use strict";
(function(root){
 async function run({key,parkRows,load,warnIfTruncated,render,onNoSelection,onError}){
  if(!key){onNoSelection();return;}
  const target=root.DG_RESOLVE_PARK_REPORT_TARGET.resolve(key,parkRows);
  const primary=root.DG_BUILD_PARK_REPORT_REQUEST.build(target);
  const legacy=root.DG_BUILD_LEGACY_PARK_REPORT_REQUEST.build(target.name);
  const result=await load(primary,legacy);
  if(result.error){onError(result.error);return;}
  if(!result.usedLegacy)warnIfTruncated(result.data,5000,target.name+" (park raporu)",result.count);
  render(target.name,result.data||[],result.count,result.usedLegacy?null:target.row);
 }
 root.DG_LOAD_PARK_REPORT=Object.freeze({run});
})(window);
