"use strict";

/* Keep visitor-screen controls declarative while routing to the established workflows. */
(function(root){
 function bind({document}){
  if(root._dgVisitorActionsBound)return;
  root._dgVisitorActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-visitor-action]');
   if(!element)return;
   switch(element.dataset.dgVisitorAction){
    case "refresh":root.dgVisRefresh();break;
    case "quick-filter":root.dgVisQuick(element.dataset.dgVisitorView||"",false);break;
    case "quick-located":root.dgVisQuick("",true);break;
    case "reset-filters":root.dgVisResetFilters();break;
    case "fit-map":root.dgVisFit();break;
    case "toggle-activity":root.dgVisActToggle();break;
   }
  });
  const update=event=>{
   const element=event.target?.closest?.('[data-dg-visitor-action]');
   if(!element)return;
   switch(element.dataset.dgVisitorAction){
    case "render":root.renderVisitorsLive();break;
    case "pause":root.dgVisPause(!!element.checked);break;
    case "draw-map":root.dgVisMapDraw(root.dgVisFilter(root.dgVisRows()));break;
   }
  };
  document.addEventListener("input",update);
  document.addEventListener("change",update);
 }
 root.DG_VISITOR_ACTIONS=Object.freeze({bind});
})(window);

window.DG_VISITOR_ACTIONS.bind({document});
