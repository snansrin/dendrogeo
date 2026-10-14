"use strict";
(function(root){
 function execute(form,ports){
  if(!form.reportValidity())return null;
  const value=Object.fromEntries(ports.formData(form));value.independent=form.elements.independent.checked;
  const result=ports.validate(value);
  if(!result.valid){
   ports.showErrors(Object.values(result.errors).join(' '));
   form.elements[Object.keys(result.errors)[0]]?.focus();
   return null;
  }
  ports.saveDraft(result.value);
  return{schema:'dendrogeo-report-context/1',study:result.value,publication_consent:true,confirmed_at:ports.now()};
 }
 root.DG_VALIDATE_REPORT_QUESTION_ANSWER=Object.freeze({execute});
})(window);
