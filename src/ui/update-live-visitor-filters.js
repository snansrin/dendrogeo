"use strict";
(function(root){
 function reset(controls,render){
  for(const control of controls.text||[])if(control)control.value="";
  if(controls.located)controls.located.checked=false;
  return render();
 }
 function quick(controls,view,located,render){
  if(controls.search)controls.search.value="";
  if(controls.view)controls.view.value=view||"";
  if(controls.located)controls.located.checked=!!located;
  return render();
 }
 root.DG_UPDATE_LIVE_VISITOR_FILTERS=Object.freeze({reset,quick});
})(window);
