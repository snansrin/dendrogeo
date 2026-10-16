/* Position the existing GIS workspace menu panel without changing menu state. */
(function(root){
 "use strict";
 function create({windowRef}){
  function position(menu){
   if(!menu?.open)return;
   const panel=menu.querySelector(":scope > .dg-editor-menu-body");
   if(!panel)return;
   const viewport=windowRef.visualViewport;
   const width=viewport?.width||windowRef.innerWidth;
   const height=viewport?.height||windowRef.innerHeight;
   const offsetTop=viewport?.offsetTop||0,offsetLeft=viewport?.offsetLeft||0;
   if(width<=700){
    const menuRect=menu.getBoundingClientRect();
    const top=Math.max(offsetTop+8,Math.min(menuRect.bottom+6,height+offsetTop-155));
    panel.style.position="fixed";
    panel.style.left=(offsetLeft+10)+"px";
    panel.style.right="auto";
    panel.style.top=top+"px";
    panel.style.width=Math.max(0,width-20)+"px";
    panel.style.maxHeight=Math.max(120,height+offsetTop-top-12)+"px";
    return;
   }
   const rect=menu.getBoundingClientRect(),ideal=Math.min(440,width-24);
   const left=Math.max(offsetLeft+12,Math.min(rect.left,width+offsetLeft-ideal-12));
   // Tablet/desktop: keep a dropdown near the lower edge inside the viewport.
   const panelHeight=Math.min(Math.max(140,panel.scrollHeight||0),Math.max(140,height-20));
   if(rect.bottom+panelHeight+8>height+offsetTop){
    panel.style.position="fixed";
    panel.style.left=left+"px";panel.style.right="auto";
    panel.style.top=Math.max(offsetTop+8,height+offsetTop-panelHeight-10)+"px";
    panel.style.width="min(440px,calc(100vw - 24px))";
    panel.style.maxHeight=Math.max(120,height-20)+"px";
    return;
   }
   panel.style.position="absolute";
   panel.style.left=(left-rect.left)+"px";
   panel.style.right="auto";
   panel.style.top="calc(100% + 6px)";
   panel.style.width="min(440px,calc(100vw - 24px))";
   panel.style.maxHeight="";
  }
  return Object.freeze({position});
 }
 root.DG_GIS_WORKSPACE_MENU_POSITION=Object.freeze({create});
})(window);
