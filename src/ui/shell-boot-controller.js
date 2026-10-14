"use strict";
/* Render boot outcomes; session access and platform startup are injected. */
window.DG_SHELL_BOOT_CONTROLLER={async run(ports){
 const {initializePlatform,trackVisit,resolveSession,finishStartup,showOAuthWait,initLanding,schedule,notify,translate,setUser,showAuth,resetAuth,showRecovery,startAuthenticated,loadProfile,setProfile,startShell,isOnline,syncOfflineData}=ports;
 initializePlatform();trackVisit();const result=await resolveSession();
 if(result.status==='oauth-error'){finishStartup();showOAuthWait('⚠ Google girişi iptal edildi veya başarısız: '+result.error);initLanding();schedule(()=>notify(translate('Google girişi tamamlanamadı: ')+result.error,'err','🔵'),400);return;}
 if(result.status==='oauth-missing'){initLanding();schedule(()=>notify('Google girişi tamamlanamadı — tekrar dene veya e-posta/parola ile gir.','warn','🔵'),400);return;}
 if(result.status==='recovery-missing'){finishStartup();initLanding();schedule(()=>{notify('Bu sıfırlama bağlantısı kullanılmış veya süresi dolmuş. Yeni bir sıfırlama maili isteyin.','warn','🔑');showAuth();resetAuth()},400);return;}
 if(result.status==='anonymous'){finishStartup();initLanding();return;}
 const user=result.session.user;setUser(user);if(result.status==='recovery'){finishStartup();showRecovery();return;}
 if(startAuthenticated)startAuthenticated(user);else{const profile=await loadProfile(user.id);setProfile(profile.data);startShell();}
 if(isOnline())schedule(()=>syncOfflineData(),2000);
}};
