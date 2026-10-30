"use strict";
(function(root){
 async function execute(id,ports){
  if(!await ports.confirm())return;
  const{data,error}=await ports.remove(id);
  if(error||!data?.length)return ports.onFailure(error);
  for(const row of data)if(row.photo_url)await ports.removePhoto(row.photo_url);
  ports.refreshRecords();ports.refreshDashboard();ports.markLiveDirty();
  if(ports.shouldRefreshMap())ports.refreshMap();
 }
 root.DG_DELETE_OWN_RECORD=Object.freeze({execute});
})(window);
