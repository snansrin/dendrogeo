"use strict";

window.DG_LOAD_LIVE_MEASUREMENTS_MAP={
  async load({element,loadMarkers,markLoaded,status,escapeHTML,format,setTimer,clusterDegraded,renderAnalysis,retry}){
    status.loading(element);
    await loadMarkers((count,rows,error)=>{
      markLoaded(!error);
      if(!element)return;
      if(error){status.error(element,error,escapeHTML,retry);return;}
      status.loaded(element,count,clusterDegraded(),format,setTimer);
      renderAnalysis(rows,"liveAnalysis");
    });
  }
};
