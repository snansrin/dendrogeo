"use strict";
/* Share one in-flight OSM coverage request for the same park boundary. */
(function(root){
  function request(boundary,{getPending,setPending,clearPending,run}){
    const pending=getPending();
    if(pending?.boundary===boundary)return pending.promise;
    const promise=run();
    setPending({boundary,promise});
    promise.finally(()=>{
      if(getPending()?.promise===promise)clearPending();
    }).catch(()=>{});
    return promise;
  }
  root.DG_SHARE_DETAILED_COVERAGE_REQUEST=Object.freeze({request});
})(window);
