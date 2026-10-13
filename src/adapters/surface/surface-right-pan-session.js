"use strict";

/* Bind and release right-button map panning without changing left-button tools. */
window.DG_SURFACE_RIGHT_PAN_SESSION={
  unbind({state}){
    const pan=state.rightPan;if(!pan)return;
    for(const [name,handler] of pan.handlers)pan.container.removeEventListener(name,handler,true);
    pan.container.style.cursor=state.brush?"crosshair":"";state.rightPan=null;
  },
  bind({state,map,unbind}){
    if(!map||typeof map.getContainer!=="function")return;
    const container=map.getContainer();if(!container?.addEventListener||state.rightPan?.container===container)return;
    unbind();
    const session=state.rightPan={container,stroke:null,handlers:[]};
    const down=e=>{if(e.button!==2||!e.isPrimary)return;e.preventDefault();e.stopImmediatePropagation();session.stroke={id:e.pointerId,x:e.clientX,y:e.clientY};try{container.setPointerCapture(e.pointerId);}catch(error){}container.style.cursor="grabbing";};
    const move=e=>{const stroke=session.stroke;if(!stroke||stroke.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const dx=e.clientX-stroke.x,dy=e.clientY-stroke.y;stroke.x=e.clientX;stroke.y=e.clientY;if(dx||dy)map.panBy([-dx,-dy],{animate:false});};
    const finish=e=>{const stroke=session.stroke;if(!stroke||stroke.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();session.stroke=null;container.style.cursor=state.brush?"crosshair":"";try{container.releasePointerCapture(e.pointerId);}catch(error){}};
    const contextmenu=e=>{e.preventDefault();e.stopImmediatePropagation();};
    for(const [name,handler] of [["pointerdown",down],["pointermove",move],["pointerup",finish],["pointercancel",finish],["contextmenu",contextmenu]]){container.addEventListener(name,handler,true);session.handlers.push([name,handler]);}
  }
};
