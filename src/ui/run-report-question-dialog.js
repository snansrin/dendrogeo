"use strict";
(function(root){
 function run(html,ports){
  const modal=ports.document.createElement('dialog');modal.className='dg-academic-dialog';modal.setAttribute('aria-labelledby','dgReportQuestionTitle');modal.innerHTML=html;
  ports.document.body.appendChild(modal);ports.setCurrent(modal);const previous=ports.document.activeElement;
  return new Promise(resolve=>{
   let done=false;
   const finish=value=>{if(done)return;done=true;modal.close();modal.remove();ports.setCurrent(null);previous?.focus?.();resolve(value);};
   modal.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
   modal.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>finish(null)));
   modal.addEventListener('close',()=>finish(null));
   modal.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const value=ports.submit(event.currentTarget,modal);if(value)finish(value);});
   modal.querySelector('[name=study_type]').value=ports.studyType;
   modal.showModal();modal.querySelector('input')?.focus();
  });
 }
 function reportError(modal,text){const element=modal.querySelector('#dgReportQuestionErrors');if(element)element.textContent=text;}
 root.DG_RUN_REPORT_QUESTION_DIALOG=Object.freeze({run,reportError});
})(window);
