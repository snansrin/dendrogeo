"use strict";
/* Project command feedback; RLS-backed command results remain authoritative. */
window.DG_PRESENT_PARK_PROJECT_RESULT={async present(kind,result,ports){const {toast,escape:esc,translateCommon:tc}=ports;
 if(kind==="create"){
  if(result.status==="unauthenticated")return toast("Oturum yok","err");
  if(result.status==="park-missing")return toast("Park kimliği sunucuya yazılmadan proje oluşturulamaz. 🔄 ile yeniden dene.","err","🌳");
  if(result.status==="write-failed")return toast(tc("Proje oluşturulamadı: ")+esc(result.error.message),"err");
  toast(tc("✓ Proje hazır: ")+esc(result.data.name),"ok","📁");
 }else{
  if(result.status==="forbidden"){toast("⛔ Mevcut projeyi parka bağlama yetkisi yalnız yöneticide. Yeni proje için park algılayabilirsin.","err","🔐");return null;}
  if(result.status==="park-missing")return toast("Önce park algıla","err","🌳");
  if(result.status==="project-missing")return toast("Proje bulunamadı","err");
  if(result.status==="write-failed")return toast(tc("Bağlanamadı: ")+esc(result.error.message),"err");
  toast("✓ "+esc(result.data.name)+" → "+esc(result.park.name),"ok","🔗");
 }
 await ports.complete(result.data);return result.data;
}};
