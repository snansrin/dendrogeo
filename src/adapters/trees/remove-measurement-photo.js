"use strict";

/* Remove the stored photo by raw and decoded public-URL path for legacy URLs. */
window.DG_REMOVE_MEASUREMENT_PHOTO={
  async remove({client,url}){
    if(!url)return;
    try{
      const path=url.split("/dendro-photos/")[1];
      if(path)await client.storage.from("dendro-photos").remove([path]);
    }catch(error){}
    try{
      const decoded=decodeURIComponent(url.split("/dendro-photos/")[1]||"");
      if(decoded)await client.storage.from("dendro-photos").remove([decoded]);
    }catch(error){}
  }
};
