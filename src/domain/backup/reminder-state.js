"use strict";
(function(root){
 function evaluate(last,now){
  const days=last?(now-new Date(last).getTime())/86400000:999;
  return{days,overdue:days>7,elapsedDays:Math.floor(days)};
 }
 root.DG_BACKUP_REMINDER_STATE=Object.freeze({evaluate});
})(window);
