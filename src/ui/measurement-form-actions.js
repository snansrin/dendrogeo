"use strict";

/* Measurement-entry event ownership; calculation and persistence stay in their existing modules. */
(function(root){
  const handlers={
    "cancel-edit":()=>root.cancelEdit(),
    "project-change":()=>root.dgProjectChanged(),
    gps:()=>root.startGps(),
    "live-share":element=>root.dgLiveShareToggle(element.checked),
    "manual-point":()=>{manualPoint=true;},
    "query-point":()=>root.queryPointId(),
    "group-change":()=>{root.fillSpecies();root.liveCalc();},
    "species-change":()=>{root.showLatin();root.liveCalc();},
    "live-calc":()=>root.liveCalc(),
    "photo-check":(_element,event)=>root.checkPhoto(event),
    "clear-photo":()=>root.dgClearMeasurePhoto(),
    save:()=>root.saveMeas()
  };
  const eventTypes={
    "cancel-edit":"click","project-change":"change",gps:"click","live-share":"change",
    "manual-point":"input","query-point":"click","group-change":"change","species-change":"change",
    "live-calc":"input","photo-check":"change","clear-photo":"click",save:"click"
  };
  function bind({document}){
    if(root._dgMeasurementFormActionsBound)return;
    root._dgMeasurementFormActionsBound=true;
    for(const type of ["click","change","input"]){
      document.addEventListener(type,event=>{
        const element=event.target?.closest?.("[data-dg-measure-action]");if(!element)return;
        const action=element.dataset.dgMeasureAction;if(eventTypes[action]!==type)return;
        handlers[action](element,event);
      });
    }
  }
  root.DG_MEASUREMENT_FORM_ACTIONS=Object.freeze({bind});
})(window);

window.DG_MEASUREMENT_FORM_ACTIONS.bind({document});
