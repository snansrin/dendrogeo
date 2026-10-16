"use strict";
/* Local form interactions only. Persistence remains with the profile save adapter. */
(function(root){
 function refresh(element){
  const form=element.querySelector?.('[data-academic-profile-form]');if(!form)return;
  const fields=[...form.querySelectorAll('input[name]')],changed=fields.some(input=>input.value!==input.defaultValue);
  const busy=form.getAttribute('aria-busy')==='true';
  form.querySelector('button[type="submit"]').disabled=busy||!changed;
  const status=element.querySelector('[data-profile-draft-status]');
  if(status)status.textContent=changed?'Kaydedilmemiş değişiklikleriniz var.':'Bilgileriniz güncel. Tüm alanlar isteğe bağlıdır.';
  const count=fields.filter(input=>input.value.trim()).length;
  const progress=element.querySelector('[data-profile-progress]');if(progress)progress.value=count;
  const label=element.querySelector('[data-profile-count]');if(label){label.setAttribute('data-i18n-text','{filled} / {total} bilgi');label.setAttribute('data-i18n-values',JSON.stringify({filled:count,total:fields.length}));label.textContent=typeof dgTf==='function'?dgTf('{filled} / {total} bilgi',{filled:count,total:fields.length}):count+' / '+fields.length+' bilgi';}
 }
 function edit(element,key){
  const details=element.querySelector('[data-profile-editor]');if(!details)return;
  details.open=true;
  const input=[...details.querySelectorAll('input[name]')].find(input=>input.name===key)||details.querySelector('input');
  input?.focus({preventScroll:true});input?.scrollIntoView({block:'nearest'});
 }
 function cancel(element){
  const form=element.querySelector('[data-academic-profile-form]');if(!form||form.getAttribute('aria-busy')==='true')return;
  form.reset();refresh(element);
  const details=element.querySelector('[data-profile-editor]');details.open=false;
  details.querySelector('summary').focus({preventScroll:true});
 }
 root.DG_ACADEMIC_PROFILE_INTERACTIONS=Object.freeze({refresh,edit,cancel});
})(window);
