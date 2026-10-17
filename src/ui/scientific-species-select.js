"use strict";

/* Native values remain the form contract; the visible control supports mixed typography. */
window.DG_SCIENTIFIC_SPECIES_SELECT=(()=>{
 const controls=new WeakMap();
 function sync(select){
  if(!select?.ownerDocument)return;
  let state=controls.get(select);
  if(!state){
   const document=select.ownerDocument,host=document.createElement("div"),button=document.createElement("button"),list=document.createElement("div");
   host.className="dg-species-select";button.type="button";button.id=select.id+"Control";button.className="dg-species-trigger";
   button.setAttribute("role","combobox");button.setAttribute("aria-haspopup","listbox");button.setAttribute("aria-expanded","false");button.setAttribute("aria-controls",select.id+"Options");
   list.id=select.id+"Options";list.className="dg-species-options";list.setAttribute("role","listbox");list.hidden=true;
   select.before(host);host.append(select,button,list);select.classList.add("dg-species-native");select.tabIndex=-1;select.setAttribute("aria-hidden","true");
   for(const label of select.labels||[]){label.htmlFor=button.id;list.setAttribute("aria-label",label.textContent);}
   let active=0,typed="",typedAt=0;
   const options=()=>Array.from(list.children);
   function highlight(index){const rows=options();if(!rows.length)return;active=(index+rows.length)%rows.length;rows.forEach((row,i)=>row.classList.toggle("is-active",i===active));button.setAttribute("aria-activedescendant",rows[active].id);const row=rows[active];if(row.offsetTop<list.scrollTop)list.scrollTop=row.offsetTop;else if(row.offsetTop+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=row.offsetTop+row.offsetHeight-list.clientHeight;}
   function close(){list.hidden=true;button.setAttribute("aria-expanded","false");button.removeAttribute("aria-activedescendant");}
   function open(){if(button.disabled)return;const bounds=button.getBoundingClientRect(),below=document.defaultView.innerHeight-bounds.bottom;list.classList.toggle("opens-up",below<180&&bounds.top>below);list.hidden=false;button.setAttribute("aria-expanded","true");highlight(Math.max(0,select.selectedIndex));}
   function choose(index){const option=select.options[index];if(!option||option.disabled)return;select.value=option.value;select.dispatchEvent(new select.ownerDocument.defaultView.Event("change",{bubbles:true}));state.render();close();button.focus();}
   button.addEventListener("click",()=>list.hidden?open():close());
   button.addEventListener("keydown",event=>{
    if(event.key==="Escape"){close();return;}
    if(event.key==="Tab"){close();return;}
    if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){event.preventDefault();if(list.hidden)open();else highlight(event.key==="Home"?0:event.key==="End"?list.children.length-1:active+(event.key==="ArrowDown"?1:-1));return;}
    if(event.key==="Enter"||event.key===" "){event.preventDefault();if(list.hidden)open();else choose(active);return;}
    if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();const now=Date.now();typed=(now-typedAt>700?"":typed)+event.key;typedAt=now;if(list.hidden)open();const index=Array.from(select.options).findIndex(option=>option.textContent.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()));if(index>=0)highlight(index);}
   });
   list.addEventListener("pointerdown",event=>event.preventDefault());
   list.addEventListener("click",event=>{const row=event.target.closest('[role="option"]');if(row)choose(Number(row.dataset.index));});
   document.addEventListener("pointerdown",event=>{if(!host.contains(event.target))close();});
   host.addEventListener("focusout",event=>{if(!host.contains(event.relatedTarget))close();});
   function label(node,text){node.replaceChildren();const separator=text.indexOf(" · ");if(separator<0){node.textContent=text;return;}node.append(document.createTextNode(text.slice(0,separator)+" · "));const latin=document.createElement("i");latin.lang="la";latin.className="dg-latin-name";latin.textContent=text.slice(separator+3);node.append(latin);}
   state={render(){
    const selected=select.options[select.selectedIndex]||select.options[0];label(button,selected?.textContent||"");button.disabled=select.disabled;
    const caret=document.createElement("span");caret.className="dg-species-caret";caret.setAttribute("aria-hidden","true");caret.textContent="⌄";button.append(caret);
    list.replaceChildren(...Array.from(select.options,(option,index)=>{const row=document.createElement("div");row.id=list.id+"-"+index;row.dataset.index=String(index);row.setAttribute("role","option");row.setAttribute("aria-selected",String(index===select.selectedIndex));label(row,option.textContent);return row;}));
    if(select.disabled)close();else if(!list.hidden)highlight(Math.max(0,select.selectedIndex));
   }};
   controls.set(select,state);select.addEventListener("change",()=>state.render());
   new select.ownerDocument.defaultView.MutationObserver(()=>state.render()).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:["disabled","selected"]});
   select.form?.addEventListener("reset",()=>setTimeout(()=>{state.render();close();},0));
  }
  state.render();
 }
 return Object.freeze({sync});
})();
