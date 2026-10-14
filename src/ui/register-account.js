"use strict";
(function(root){
 async function execute(ports){
  const{name,email,password,organization,consent,token,wait,showMessage,auth,resetWidget,redirectTo,now}=ports;
  if(!name||!email||!password){showMessage("Tüm alanları doldurun.",true);return;}
  if(password.length<6){showMessage("Parola en az 6 karakter olmalı.",true);return;}
  if(consent&&!consent.checked){
   showMessage("Devam etmek için KVKK Aydınlatma Metni ve Gizlilik Politikası onay kutusunu işaretleyin.",true);
   if(consent.focus)consent.focus();
   return;
  }
  showMessage("Hesap oluşturuluyor...",false);
  let captcha=token("tsReg");
  if(!captcha){await wait(2500);captcha=token("tsReg");}
  if(!captcha){showMessage("Doğrulama widget'ı hazır değil. Sayfayı yenileyip tekrar deneyin.",true);return;}
  const result=await auth.signUp({email,password,options:{data:{
   full_name:name,organization,kvkk_consent:true,kvkk_consent_at:now(),kvkk_consent_version:"1.0",kvkk_consent_source:"kayit-formu"
  },captchaToken:captcha,redirectTo}});
  if(result.error){showMessage(result.error.message,true);return;}
  try{resetWidget("tsReg");}catch(e){}
  showMessage(result.data.session?"Hesap oluşturuldu.":"✓ Doğrulama e‑postası gönderildi — maildeki linke tıklayın.",false);
 }
 root.DG_REGISTER_ACCOUNT=Object.freeze({execute});
})(window);
