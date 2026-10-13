"use strict";
(function(root){
 function owned(rows){return(rows||[]).filter(park=>park.role==="owner");}
 function shared(rows){return(rows||[]).filter(park=>park.role==="collaborator");}
 function canManage(parkId,rows){return owned(rows).some(park=>Number(park.id)===Number(parkId));}
 root.DG_PARK_INVITE_ACCESS=Object.freeze({owned,shared,canManage});
})(window);
