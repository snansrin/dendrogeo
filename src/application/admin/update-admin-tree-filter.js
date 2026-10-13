"use strict";
(function(root){
 function setStatus(state,value,ports){
  const status=value||"";
  if(ports.setStatus)ports.setStatus(status);else state.status=status;
  if(ports.updateStatusControl)ports.updateStatusControl(status);
  return ports.draw();
 }
 function setQuery(state,value,ports){
  const query=value||"";
  if(ports.setQuery)ports.setQuery(query);else state.query=query;
  return ports.draw();
 }
 function onlyPending(state,ports){
  return setStatus(state,"Beklemede",ports);
 }
 root.DG_UPDATE_ADMIN_TREE_FILTER=Object.freeze({setStatus,setQuery,onlyPending});
})(window);
