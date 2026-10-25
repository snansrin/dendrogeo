"use strict";
/* Stage window is a sibling of the real rail, never a child replaced by it. */
(function(root){
 function create({document,windowRef,getMap}){
  let panel=null,workspace=null,observer=null,resize=null,frame=0;
  function position(){
   if(!panel||!workspace)return;
   const box=workspace.getBoundingClientRect(),rail=document.querySelector("#surfaceMapTools .dg-editor-rail"),tools=rail?.getBoundingClientRect(),shown=tools&&tools.width>0&&tools.height>0;
   const left=shown?Math.max(8,tools.right-box.left+8):8,top=shown?Math.max(8,tools.top-box.top):88,available=Math.max(44,box.width-left-8),collapsed=panel.dataset.collapsed==="true";
   panel.style.left=left+"px";panel.style.top=top+"px";panel.style.width=Math.min(collapsed?58:320,available)+"px";
   panel.style.maxHeight=Math.max(120,Math.min(box.height-top-8,(windowRef.visualViewport?.height||windowRef.innerHeight)-24))+"px";
  }
  function schedule(){if(frame)return;frame=windowRef.requestAnimationFrame(()=>{frame=0;position();});}
  function clear(){if(frame)windowRef.cancelAnimationFrame(frame);frame=0;observer?.disconnect();resize?.disconnect();windowRef.removeEventListener("resize",schedule);windowRef.visualViewport?.removeEventListener("resize",schedule);panel?.remove();panel=null;if(workspace){workspace.classList.remove("dg-stage-side-active");getMap?.()?.invalidateSize?.({pan:false});}workspace=null;}
  function mount(element){
   clear();workspace=document.getElementById("surfaceMapWorkspace");if(!workspace)return;panel=element;workspace.classList.add("dg-stage-side-active");workspace.append(panel);getMap?.()?.invalidateSize?.({pan:false});
   if(windowRef.ResizeObserver){resize=new windowRef.ResizeObserver(schedule);resize.observe(workspace);const tools=document.getElementById("surfaceMapTools");if(tools)resize.observe(tools);}
   if(windowRef.MutationObserver){observer=new windowRef.MutationObserver(schedule);const tools=document.getElementById("surfaceMapTools");if(tools)observer.observe(tools,{childList:true,subtree:true,attributes:true});}
   windowRef.addEventListener("resize",schedule);windowRef.visualViewport?.addEventListener("resize",schedule);position();
  }
  return Object.freeze({mount,position,clear});
 }
 root.DG_PARK_STAGE_SIDE_LAYOUT=Object.freeze({create});
})(window);
