"use strict";
(function(root){
 async function execute(ports){
  const{password,confirmation,updatePassword,setMessage,toast,replaceHistory,reload}=ports;
  if(password.length<6){setMessage("Parola en az 6 karakter olmalı.",true);return;}
  if(password!==confirmation){setMessage("Parolalar eşleşmiyor.",true);return;}
  const{error}=await updatePassword(password);
  if(error){setMessage("Hata: "+error.message,true);return;}
  toast("✓ Parola güncellendi — yeni parolanızla giriş yapın","ok","🔑");
  replaceHistory();
  reload();
 }
 root.DG_SAVE_NEW_PASSWORD=Object.freeze({execute});
})(window);
