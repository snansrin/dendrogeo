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
   const rect=menu.getBoundingClientRect(),mobile=width<=700;
   const panelWidth=Math.max(0,Math.min(mobile?width-20:440,width-24));
   const left=Math.max(offsetLeft+12,Math.min(rect.left,width+offsetLeft-panelWidth-12));
   const panelHeight=Math.min(Math.max(140,panel.scrollHeight||0),Math.max(140,height-20));
   const below=Math.max(0,height+offsetTop-rect.bottom-12);
   // Reserve the fixed application header when a long menu opens upward.
   // Without this inset the first controls disappear behind the header.
   const headerInset=width>700?72:56;
   const above=Math.max(0,rect.top-offsetTop-headerInset-12);
   const openAbove=below<panelHeight&&above>below;

   /* Keep the panel in the trigger's coordinate system. It now scrolls with
    * its heading instead of switching between viewport-fixed and absolute
    * positions, which caused the menu to jump as the map page moved. */
   menu.style.position="relative";
   panel.style.position="absolute";
   panel.style.left=(left-rect.left)+"px";
   panel.style.right="auto";
   panel.style.width=panelWidth+"px";
   panel.style.top=openAbove?"auto":"calc(100% + 6px)";
   panel.style.bottom=openAbove?"calc(100% + 6px)":"auto";
   panel.style.maxHeight=Math.max(120,Math.min(panelHeight,(openAbove?above:below)-6))+"px";
  }
  return Object.freeze({position});
 }
 root.DG_GIS_WORKSPACE_MENU_POSITION=Object.freeze({create});
})(window);
