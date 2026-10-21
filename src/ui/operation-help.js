"use strict";
/* Add read-only help beside controls without moving or invoking the controls. */
(function(root){
 const pairs=new Map();let dialog,lastTrigger,scheduled=false,observer,escapePending=false;
 const anchors=[
  ['.waypoint-target-copy>.lbl','navActions'],['#waypointListTitle','pointList'],['#waypointFileTitle','pointUpload'],
  ['#measureLocationTitle','gps'],['#measureTreeTitle','measure'],['.measure-photo h4','photo'],
  ['label[for="pLabel"]','project'],['#projectOwnedTitle','ownedProjects'],['#projectSharedTitle','sharedProjects'],['#projectTeamTitle','sharing'],
  ['.records-heading h2','records'],
  ['.export-format-card:has([data-dg-export-action="csv-download"])>h3','tableCsv'],
  ['.export-format-card:has([data-dg-export-action="geo-download"])>h3','recordGeojson'],
  ['.export-format-card:has([data-dg-export-action="qgis-download"])>h3','qgisCsv'],
  ['.export-panel-body:has(.export-request-grid)>.export-copy','request'],
  ['#gridSummary>b:first-child','gridResults'],
  ['label[for="gridSize"]','gridSize'],['label[for="refHa"]','reference'],['label[for="gridClearance"]','clearance'],
  ['#dgMaintenanceLabel','maintenance'],['#dgBackupLabel','backupRestore'],['#adminPublishTitle','report'],
  ['.card:has(#aReqT)>.shead h2','reply'],['.card:has(#admExpCountry)>.shead h2','adminExport'],
  ['#adminUsersListTitle','users']
 ];
 const menuTopics={'10':'fileMenu','20':'viewMenu','30':'grid','40':'layerMenu','50':'brush','60':'boundary','70':'scan'};
 const selector=anchors.map(([query])=>query).concat('.dg-editor-panel-head strong').join(',');
 const language=()=>root.document.documentElement.lang==='en'?'en':'tr';
 const t=(tr,en)=>language()==='en'?en:tr;
 function topic(control){
  for(const[query,key]of anchors)if(control.matches(query))return key;
  if(control.matches('.dg-editor-panel-head strong'))return menuTopics[control.closest('details[data-menu-order]')?.dataset.menuOrder]||null;
  return null;
 }
 function content(control){return root.DG_OPERATION_HELP_CONTENT.get(topic(control),language());}
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
 function add(control){
  if(pairs.has(control)||!topic(control)||!control.closest('#shell')||control.closest('button,a,summary,label:has(input),#dgOperationHelp,.dg-operation-help'))return;
  const doc=root.document,button=doc.createElement('button');button.type='button';button.className='dg-operation-help';
  const mark=doc.createElement('span');mark.setAttribute('aria-hidden','true');button.append(mark);
  button.dataset.dgHelpTopic=topic(control);
  button.setAttribute('aria-label',content(control).title+' — '+t('Nasıl kullanılır?','How to use'));
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','dgOperationHelp');
  button.title=t('Kullanım talimatları','Instructions');
  control.append(button);pairs.set(control,button);
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
