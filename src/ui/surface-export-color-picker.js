"use strict";
/* Keep the original browser color palette and provide an external Done target. */
(function(root){
 function bind({dialog}){
  const field=dialog.querySelector('#dgExportBoundaryColor'),done=dialog.querySelector('#dgExportColorDone');
  if(!field||!done)return;
  done.addEventListener('click',()=>{field.blur();done.focus();});
 }
 root.DG_SURFACE_EXPORT_COLOR_PICKER=Object.freeze({bind});
})(window);
