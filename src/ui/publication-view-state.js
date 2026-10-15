"use strict";
/* Browser visibility reads for report publication polling. */
(function(root){
 function create(document){
  const byId=id=>document.getElementById(id);
  return Object.freeze({
   isActive:id=>{const view=byId(id);return !view||view.classList.contains("on");},
   isVisible:id=>{const node=byId(id);return !!node&&node.style.display!=="none";},
   isDocumentHidden:()=>!!document.hidden
  });
 }
 root.DG_PUBLICATION_VIEW_STATE=Object.freeze({create});
})(window);
