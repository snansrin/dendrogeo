"use strict";
(function(root){
 function start(ports){
  stop(ports);
  ports.setTimer(ports.setInterval(()=>{
   try{if(ports.isVisitorsView())ports.render();}catch(error){}
  },10000));
 }
 function stop(ports){const timer=ports.getTimer();if(timer){ports.clearInterval(timer);ports.setTimer(null);}}
 root.DG_VISITOR_LIVE_REFRESH_TIMER=Object.freeze({start,stop});
})(window);
