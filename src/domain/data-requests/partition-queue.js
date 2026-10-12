"use strict";

/* Preserve the queue's status classification and input order. */
(function(root){
 function partition(requests){
  return{
   pending:requests.filter(row=>row.status!=="Tamamlandı"&&row.status!=="Reddedildi"),
   closed:requests.filter(row=>row.status==="Tamamlandı"||row.status==="Reddedildi")
  };
 }
 root.DG_DATA_REQUEST_QUEUE=Object.freeze({partition});
})(window);
