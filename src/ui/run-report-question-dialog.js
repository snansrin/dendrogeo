"use strict";
(function(root){
 function run(html,ports){
  const modal=ports.document.createElement('dialog');modal.className='dg-academic-dialog';modal.setAttribute('aria-labelledby','dgReportQuestionTitle');modal.innerHTML=html;
  ports.document.body.appendChild(modal);ports.setCurrent(modal);const previous=ports.document.activeElement;
  const scrollLocks=[ports.document.documentElement,ports.document.body].filter(element=>element?.style).map(element=>({element,overflow:element.style.overflow}));
  scrollLocks.forEach(({element})=>{element.style.overflow='hidden';});
  return new Promise((resolve,reject)=>{
   let done=false;
   const finish=(value,error)=>{if(done)return;done=true;modal.close();modal.remove();scrollLocks.forEach(({element,overflow})=>{element.style.overflow=overflow;});ports.setCurrent(null);previous?.focus?.({preventScroll:true});if(error)reject(error);else resolve(value);};
   modal.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
   modal.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>finish(null)));
   modal.addEventListener('close',()=>finish(null));
   modal.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const value=ports.submit(event.currentTarget,modal);if(value)finish(value);});
   modal.querySelector('[name=study_type]').value=ports.studyType;
   try{modal.showModal();modal.querySelector('#dgReportQuestionTitle')?.focus({preventScroll:true});}
   catch(error){finish(null,error);}
  });
 }
 function reportError(modal,text){const element=modal.querySelector('#dgReportQuestionErrors');if(element)element.textContent=text;}
 root.DG_RUN_REPORT_QUESTION_DIALOG=Object.freeze({run,reportError});
})(window);
