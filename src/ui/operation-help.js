"use strict";
/* Add read-only help beside controls without moving or invoking the controls. */
(function(root){
 const pairs=new Map();let dialog,lastTrigger,scheduled=false,observer,escapePending=false;
 const selector='button,input:not([type="hidden"]),select,textarea,.view>.shead h2,.dg-editor-panel-head strong';
 const language=()=>root.document.documentElement.lang==='en'?'en':'tr';
 const t=(tr,en)=>language()==='en'?en:tr;
 function descriptor(control){
  return{id:control.id||'',attributes:Object.fromEntries(Array.from(control.attributes).map(a=>[a.name,a.value])),view:control.closest('.view')?.id||'',menu:control.closest('details[data-menu-order]')?.dataset.menuOrder||'',text:control.getAttribute('aria-label')||control.getAttribute('title')||control.textContent||''};
 }
 function content(control){return root.DG_OPERATION_HELP_CONTENT.get(root.DG_OPERATION_HELP_CONTENT.resolve(descriptor(control)),language());}
 function makeDialog(){
  if(dialog)return dialog;
  const doc=root.document;dialog=doc.createElement('dialog');dialog.id='dgOperationHelp';dialog.className='dg-operation-help-dialog';
  dialog.setAttribute('aria-labelledby','dgOperationHelpTitle');
  const header=doc.createElement('div');header.className='dg-operation-help-header';
  const title=doc.createElement('h2');title.id='dgOperationHelpTitle';
  const close=doc.createElement('button');close.type='button';close.className='btn sm ghost';close.dataset.dgHelpClose='';
  const body=doc.createElement('div');body.className='dg-operation-help-body';body.id='dgOperationHelpBody';
  header.append(title,close);dialog.append(header,body);doc.body.append(dialog);
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{event.stopPropagation();if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{if(lastTrigger?.isConnected)lastTrigger.focus({preventScroll:true});});
  return dialog;
 }
 function open(control,trigger){
  const entry=content(control),box=makeDialog(),doc=root.document;lastTrigger=trigger;
  box.querySelector('h2').textContent=entry.title;
  box.querySelector('[data-dg-help-close]').textContent=t('Kapat','Close');
  const body=box.querySelector('.dg-operation-help-body');body.replaceChildren();
  const intro=doc.createElement('p');intro.className='dg-meta';intro.textContent=t('Nasıl kullanılır?','How to use');
  const list=doc.createElement('ol');for(const step of entry.steps){const item=doc.createElement('li');item.textContent=step;list.append(item);}
  body.append(intro,list);if(!box.open)box.showModal();
 }
 function eligible(control){
  if(!control.closest('#shell')||control.closest('#dgOperationHelp,.dg-operation-help,.dg-field-help,.leaflet-control-zoom')||control.matches('[type="hidden"],[type="password"],.dg-lang-toggle,[data-dg-help-skip]'))return false;
  if(control.tagName==='BUTTON')return !!(control.textContent.trim()||control.getAttribute('aria-label')||control.getAttribute('title'));
  return true;
 }
 function add(control){
  if(pairs.has(control)){
   const button=pairs.get(control);
   if(control.tagName==='BUTTON'&&control.nextElementSibling!==button)control.insertAdjacentElement('afterend',button);
   return;
  }
  if(!eligible(control))return;
  let host=null;
  if(control.matches('input,select,textarea')){
   const label=control.labels?.[0]||control.closest('.dg-png-field,.dg-sens-row')?.querySelector('label,.dg-sens-label')||control.parentElement?.querySelector(':scope>label,:scope>.lbl');
   if(label?.querySelector('.dg-field-help'))return;
   host=label?.querySelector('.dg-png-copy strong,.measure-label-copy')||label;
   // Some slider captions are themselves action buttons with their own guide.
   if(host?.matches('button,[role="button"],a[href]'))return;
   if(host?.querySelector('.dg-operation-help'))return;
  }
  const doc=root.document,button=doc.createElement('button');button.type='button';button.className='btn sm ghost dg-operation-help';button.textContent='?';
  button.setAttribute('aria-label',content(control).title+' — '+t('Nasıl kullanılır?','How to use'));
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','dgOperationHelp');
  button.title=t('Kullanım talimatları','Instructions');
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open(control,button);});
  if(host&&control.matches('input[type="checkbox"],input[type="radio"]')){(control.labels?.[0]||host).insertAdjacentElement('afterend',button);}
  else if(host){host.append(button);host.classList.add('dg-operation-help-label');}
  else{const anchor=control.type==='file'?(control.closest('.dg-file')||control):control;anchor.insertAdjacentElement('afterend',button);if(control.tagName==='BUTTON')control.classList.add('dg-has-operation-help');}
  const parent=control.parentElement;
  if(control.tagName==='BUTTON'&&parent?.matches('.dg-editor-action-grid,.dg-ux-tool-grid,.admin-storage-actions,#gridSummary>div'))parent.classList.add('dg-operation-help-grid');
  pairs.set(control,button);
 }
 function scan(node=root.document.getElementById('shell')){
  if(!node||node.nodeType!==1||node.closest('#dgOperationHelp,.dg-operation-help'))return;
  if(node.matches(selector))add(node);
  node.querySelectorAll(selector).forEach(add);
 }
 function schedule(nodes){
  for(const node of nodes)scan(node);
  if(scheduled)return;scheduled=true;
  root.requestAnimationFrame(()=>{scheduled=false;for(const[control,button]of pairs)if(!control.isConnected){button.remove();pairs.delete(control);}});
 }
 function init(){
  const doc=root.document;if(!root.DG_OPERATION_HELP_CONTENT||root._dgOperationHelpBound||typeof root.MutationObserver!=='function'||typeof doc.body?.append!=='function')return;
  root._dgOperationHelpBound=true;makeDialog();scan();
  // Help must never submit a form, toggle a switch, start drawing, or cancel an edit.
  for(const name of ['pointerdown','mousedown','touchstart'])root.addEventListener(name,event=>{if(event.target.closest?.('.dg-operation-help')||(dialog?.open&&dialog.contains(event.target)))event.stopPropagation();},{capture:true,passive:true});
  root.addEventListener('click',event=>{
   if(dialog?.open&&dialog.contains(event.target)){
    event.stopPropagation();
    if(event.target.closest?.('[data-dg-help-close]')){event.preventDefault();dialog.close();}
    else if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}
    return;
   }
   const button=event.target.closest?.('.dg-operation-help');if(!button)return;
   event.preventDefault();event.stopPropagation();for(const[control,help]of pairs)if(help===button){open(control,button);break;}
  },true);
  root.addEventListener('keydown',event=>{if(dialog?.open&&event.key==='Escape'){escapePending=true;event.stopPropagation();}},true);
  root.addEventListener('keyup',event=>{if(escapePending&&event.key==='Escape'){escapePending=false;event.stopPropagation();}},true);
  root.addEventListener('dg:lang',()=>{for(const[control,button]of pairs){button.setAttribute('aria-label',content(control).title+' — '+t('Nasıl kullanılır?','How to use'));button.title=t('Kullanım talimatları','Instructions');if(dialog?.open&&lastTrigger===button)open(control,button);}});
  observer=new root.MutationObserver(records=>{const nodes=[];for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&!node.matches('.dg-operation-help'))nodes.push(node);if(nodes.length||records.some(record=>record.removedNodes.length))schedule(nodes);});
  const shell=doc.getElementById('shell');if(shell)observer.observe(shell,{childList:true,subtree:true});
 }
 root.DG_OPERATION_HELP=Object.freeze({init,scan,open});
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
