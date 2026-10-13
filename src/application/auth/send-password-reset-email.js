"use strict";
(function(root){
 async function execute(ports){
  const{email,token,wait,showMessage,auth,resetWidget,redirectTo}=ports;
  if(!email){showMessage("Lütfen e-posta adresinizi girin.",true);return;}
  let captcha=token("tsReset");
  if(!captcha){showMessage("Widget yükleniyor, lütfen bekleyin...",false);await wait(2500);captcha=token("tsReset");}
  if(!captcha){showMessage("Doğrulama widget'ı hazır değil. Sayfayı yenileyip tekrar deneyin.",true);return;}
  showMessage("Şifre sıfırlama talebi gönderiliyor...",false);
  try{
   const result=await auth.resetPasswordForEmail(email,{captchaToken:captcha,redirectTo});
   if(result&&result.error){showMessage("Hata: "+result.error.message,true);try{resetWidget("tsReset");}catch(e){}return;}
   try{resetWidget("tsReset");}catch(e){}
   showMessage("✓ Sıfırlama bağlantısı e-postanıza gönderildi. Spam klasörünü de kontrol edin.",false);
  }catch(error){
   showMessage("Beklenmeyen hata: "+(error&&error.message?error.message:String(error)),true);
   try{resetWidget("tsReset");}catch(e){}
  }
 }
 root.DG_SEND_PASSWORD_RESET_EMAIL=Object.freeze({execute});
})(window);
