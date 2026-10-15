"use strict";
/* Bind declarative surface-editor controls to injected UI actions. */
(function(root){
  const bound=new WeakSet();
  function bind(container,actions){
    if(!container||bound.has(container))return;
    bound.add(container);
    const closest=(event,attribute)=>event.target?.closest?.(`[${attribute}]`);
    container.addEventListener('click',event=>{
      const element=closest(event,'data-dg-click');if(!element||!container.contains(element)||element.disabled)return;
      actions[element.dataset.dgClick]?.(element,event);
    });
    for(const [eventName,dataName] of [['change','dgChange'],['input','dgInput']])container.addEventListener(eventName,event=>{
      const element=closest(event,'data-dg-'+eventName);if(!element||!container.contains(element)||element.disabled)return;
      actions[element.dataset[dataName]]?.(element,event);
    });
    container.addEventListener('toggle',event=>{
      const element=event.target;if(!element?.matches?.('[data-dg-toggle]')||!container.contains(element))return;
      actions[element.dataset.dgToggle]?.(element,event);
    },true);
  }
  root.DG_BIND_SURFACE_EDITOR_EVENTS=Object.freeze({bind});
})(window);
