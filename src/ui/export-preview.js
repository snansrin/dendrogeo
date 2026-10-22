"use strict";
(function(root){
 const bound=new WeakSet(),locks=new WeakMap(),triggers=new WeakMap();
 function csvRows(content){
  const rows=[];let row=[],cell='',quoted=false;
  const finish=()=>{if(cell||row.length){row.push(cell);rows.push(row);}row=[];cell='';};
  const text=content.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length&&rows.length<100;i++){
   const char=text[i];
   if(char==='"'){
    if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
   }else if(char===','&&!quoted){row.push(cell);cell='';}
   else if((char==='\n'||char==='\r')&&!quoted){finish();if(char==='\r'&&text[i+1]==='\n')i++;}
   else cell+=char;
  }
  if(rows.length<100)finish();return rows;
 }
 function restore(modal){
  for(const [element,overflow]of locks.get(modal)||[])element.style.overflow=overflow;
  locks.delete(modal);modal.classList.remove('on');
  const trigger=triggers.get(modal);triggers.delete(modal);if(trigger?.isConnected)trigger.focus({preventScroll:true});
 }
 function open(modal){
  if(!modal)return false;
  if(!bound.has(modal)&&modal.addEventListener){
   bound.add(modal);
   modal.addEventListener('close',()=>{if(!modal.open)restore(modal);});
   modal.addEventListener('cancel',event=>{event.preventDefault();close(modal.ownerDocument);});
   modal.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const items=[...modal.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const active=modal.ownerDocument.activeElement,first=items[0],last=items.at(-1);
    if(event.shiftKey&&active===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&active===last){event.preventDefault();first?.focus();}
   });
   for(const name of ['keydown','keyup'])modal.addEventListener(name,event=>{if(event.key==='Escape')event.stopPropagation();});
   modal.addEventListener('click',event=>{if(event.target===modal)close(modal.ownerDocument);});
  }
  if(!locks.has(modal)){
   const doc=modal.ownerDocument,items=[doc?.documentElement,doc?.body].filter(el=>el?.style).map(el=>[el,el.style.overflow]);
   triggers.set(modal,doc?.activeElement);
   locks.set(modal,items);for(const [element]of items)element.style.overflow='hidden';
  }
  modal.classList.add('on');
  if(!modal.open)modal.showModal?.();
  return true;
 }
 function render(title,content,isCSV,filename,{document,escape,download}){
  const titleElement=document.getElementById("pvTitle"),body=document.getElementById("pvBody"),downloadButton=document.getElementById("pvDownload"),modal=document.getElementById("previewModal");
  if(!titleElement||!body||!downloadButton||!modal)return false;
  titleElement.textContent=title;
  if(isCSV){
   const lines=csvRows(content);
   let html="<table><thead><tr>"+(lines[0]||[]).map(header=>`<th scope='col'>${escape(header)}</th>`).join("")+"</tr></thead><tbody>";
   for(let index=1;index<lines.length;index++)html+="<tr>"+lines[index].map(cell=>`<td>${escape(cell)}</td>`).join("")+"</tr>";
   body.innerHTML=(lines.length<2?`<p class="dg-meta" role="status">${document.documentElement?.lang==='en'?'No measurements to preview.':'Önizlenecek ölçüm kaydı yok.'}</p>`:'')+html+"</tbody></table>";
  }else body.innerHTML=`<pre style="font-size:.75rem;white-space:pre-wrap">${escape(content.slice(0,20000))}</pre>`;
  downloadButton.onclick=()=>download(content,filename);
  return open(modal);
 }
 function close(document){const modal=document.getElementById("previewModal");if(!modal)return;modal.close?.();restore(modal);}
 root.DG_EXPORT_PREVIEW_UI=Object.freeze({render,close,open});
})(window);
