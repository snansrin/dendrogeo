"use strict";
/* Preserve simple help formatting; never attach attributes or active markup. */
(function(root){
 const allowed=new Set(['B','STRONG','BR','EM','I','CODE','SMALL','SPAN']);
 function render(container,value){
  const doc=container.ownerDocument,template=doc.createElement('template');
  template.innerHTML=String(value??'');
  const content=doc.createDocumentFragment();
  function copy(node,parent){
   if(node.nodeType===3){parent.append(doc.createTextNode(node.nodeValue));return;}
   if(node.nodeType!==1)return;
   if(!allowed.has(node.tagName)){parent.append(doc.createTextNode(node.outerHTML));return;}
   const clean=doc.createElement(node.tagName.toLowerCase());
   for(const child of node.childNodes)copy(child,clean);
   parent.append(clean);
  }
  for(const node of template.content.childNodes)copy(node,content);
  container.replaceChildren(content);
 }
 root.DG_TOAST_MESSAGE_CONTENT=Object.freeze({render});
})(window);
