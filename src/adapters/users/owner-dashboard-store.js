"use strict";
(function(root){
 function load(client,userId){return client.from("measurements").select("*").eq("owner",userId);}
 root.DG_OWNER_DASHBOARD_STORE=Object.freeze({load});
})(window);
