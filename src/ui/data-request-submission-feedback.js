"use strict";
(function(root){
 function duplicate(element,status,{translateFormatted}={}){
  element.style.color="var(--amber)";
  const state=status==="Beklemede"?"beklemede":"işleme alındı";
  element.textContent=typeof translateFormatted==="function"
   ?translateFormatted("⚠ Aynı filtreyle bir talebiniz zaten {s}. Yönetici yanıt verene kadar yeni talep oluşturulamaz.",{s:state})
   :"⚠ Aynı filtreyle bir talebiniz zaten "+state+". Yönetici yanıt verene kadar yeni talep oluşturulamaz.";
 }
 function failure(element,error){
  element.style.color="var(--red)";element.textContent="Hata: "+error.message;
 }
 function success(element){
  element.style.color="var(--green-dk)";element.textContent="✓ Talebiniz yönetime iletildi, hazır olduğunda e‑postanıza gönderilecek.";
 }
 root.DG_DATA_REQUEST_SUBMISSION_FEEDBACK_UI=Object.freeze({duplicate,failure,success});
})(window);
