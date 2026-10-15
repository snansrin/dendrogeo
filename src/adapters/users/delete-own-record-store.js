"use strict";
(function(root){
 async function remove(client,id){return client.from("measurements").delete().eq("id",id).select("photo_url");}
 root.DG_DELETE_OWN_RECORD_STORE=Object.freeze({remove});
})(window);
