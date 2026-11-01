"use strict";

/* Surface a Presence failure and retry the same park session at most twice. */
window.DG_FAIL_PARK_LIVE_SHARE={
  fail({setLive,retries,setRetries,note,translate,setTimer,removeChannel,resetChannel,isEnabled,join}){
    setLive(false);
    if(note)note.textContent=translate("⚠ Ortak konumu bağlanamadı (Supabase Realtime). İnternet, oturum veya park erişimi kontrol edilmeli. Canlı konum şu anda gösterilemiyor.");
    try{removeChannel();}catch(error){}
    resetChannel();
    if(retries()<2){
      setRetries(retries()+1);
      setTimer(()=>{if(isEnabled())join();},3000);
    }
  }
};
