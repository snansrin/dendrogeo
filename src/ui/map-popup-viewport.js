"use strict";
/* Keep measurement popups inside the visible map, including late photo loads. */
(function(root){
 function attach(marker){
  let cleanup=()=>{};
  marker.on?.('popupopen',event=>{
   cleanup();const popup=event.popup,element=popup.getElement?.(),container=element?.closest('.leaflet-container');if(!container)return;
   // Keep the same photo nodes when Leaflet recalculates popup layout.
   if(typeof popup.getContent?.()==='string'){
    const content=element.querySelector('.leaflet-popup-content'),body=root.document.createElement('div');
    if(content){while(content.firstChild)body.append(content.firstChild);popup.setContent(body);}
   }
   let frame=null,closed=false,lastLayout=null,photoChanged=true,revealUntil=Date.now()+1000;
   const update=()=>{
    frame=null;if(closed)return;
    const box=container.getBoundingClientRect(),viewport=root.visualViewport;
    const left=viewport?.offsetLeft||0,right=left+(viewport?.width||root.innerWidth),bottom=(viewport?.offsetTop||0)+(viewport?.height||root.innerHeight);
    let top=viewport?.offsetTop||0;
    for(const bar of root.document.querySelectorAll('#apptop,#side')){
     const rect=bar.getBoundingClientRect(),position=root.getComputedStyle(bar).position;
     if((position==='sticky'||position==='fixed')&&rect.width>(right-left)*.7&&rect.top<=top+1&&rect.bottom>top)top=rect.bottom;
    }
    const visibleWidth=Math.min(box.right,right)-Math.max(box.left,left),visibleHeight=Math.min(box.bottom,bottom)-Math.max(box.top,top);
    if(visibleWidth<80||visibleHeight<80){
     if(box.width!==0&&box.height!==0&&Date.now()<revealUntil){container.scrollIntoView?.({block:'center',behavior:'instant'});schedule();}
     else marker.closePopup?.();
     return;
    }
    const layout=[box.left,box.right,box.top,box.bottom,left,right,top,bottom].join(':');
    if(layout===lastLayout&&!photoChanged)return;lastLayout=layout;photoChanged=false;
    popup.options.maxWidth=Math.max(80,Math.min(280,visibleWidth-48));popup.options.minWidth=Math.min(140,popup.options.maxWidth);
    popup.options.maxHeight=Math.max(32,Math.floor(visibleHeight-72));
    popup.options.autoPanPaddingTopLeft=[Math.max(12,left-box.left+12),Math.max(12,top-box.top+12)];
    popup.options.autoPanPaddingBottomRight=[Math.max(12,box.right-right+12),Math.max(12,box.bottom-bottom+12)];
    popup.update();
   };
   const schedule=()=>{if(frame===null&&!closed)frame=root.requestAnimationFrame(update);};
   const onResize=()=>{revealUntil=Date.now()+1000;schedule();};
   const onScroll=event=>{if(event.target===root.document||event.target?.contains?.(container))schedule();};
   root.addEventListener('resize',onResize);root.document.addEventListener('scroll',onScroll,true);
   root.visualViewport?.addEventListener('resize',onResize);root.visualViewport?.addEventListener('scroll',schedule);
   const imageKey=()=>Array.from(element.querySelectorAll('img'),image=>[image.currentSrc||image.src,image.naturalWidth,image.naturalHeight].join(':')).join('|');
   let imageState=imageKey();const onImage=()=>{const next=imageKey();if(next!==imageState){imageState=next;photoChanged=true;schedule();}};
   element.addEventListener('load',onImage,true);element.addEventListener('error',onImage,true);
   const observer=typeof root.ResizeObserver==='function'?new root.ResizeObserver(schedule):null;observer?.observe(container);if(root.document.documentElement)observer?.observe(root.document.documentElement);
   cleanup=()=>{closed=true;observer?.disconnect();if(frame!==null)root.cancelAnimationFrame(frame);root.removeEventListener('resize',onResize);root.document.removeEventListener('scroll',onScroll,true);root.visualViewport?.removeEventListener('resize',onResize);root.visualViewport?.removeEventListener('scroll',schedule);element.removeEventListener('load',onImage,true);element.removeEventListener('error',onImage,true);};
   schedule();
  });
  marker.on?.('popupclose',()=>cleanup());marker.on?.('remove',()=>cleanup());
  return marker;
 }
 root.DG_MAP_POPUP_VIEWPORT=Object.freeze({attach});
})(window);
