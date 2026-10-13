"use strict";
(function(root){
 async function execute(ports){
  const{email,password,token,wait,showMessage,auth,resetWidget,setUser,setProfile,startShell,isOnline,schedule,syncOffline}=ports;
  if(!email||!password){showMessage("E-posta ve parola gerekli.",true);return;}
  showMessage("Giriş yapılıyor...",false);
  let captcha=token("tsLogin");
  if(!captcha){await wait(2500);captcha=token("tsLogin");}
  if(!captcha){showMessage("Doğrulama widget'ı hazır değil. Sayfayı yenileyip tekrar deneyin.",true);return;}
  const result=await auth.signInWithPassword({email,password,options:{captchaToken:captcha}});
  if(result.error){showMessage(result.error.message,true);try{resetWidget("tsLogin");}catch(e){}return;}
  try{resetWidget("tsLogin");}catch(e){}
  const user=result.data.user;
  setUser(user);
  const{data:profile}=await ports.loadProfile(user.id);
  setProfile(profile);
  startShell();
  if(isOnline())schedule(()=>syncOffline(),2000);
 }
 root.DG_LOGIN_WITH_PASSWORD=Object.freeze({execute});
})(window);
