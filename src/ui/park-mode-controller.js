"use strict";
/* Coordinate park mode presentation and the existing map readiness fallback. */
(function(root){
 function create({getMode,setMode,getButton,getHint,bindClick,clearCandidates,clear,getMap,notify}){
function toggleParkModeController(){
  let mode=!getMode();setMode(mode);

  const b=getButton();
  const hint=getHint();

  if(b){
    b.textContent=
      "🌳 Park Analizi Modu: "+
      (mode?"AÇIK":"KAPALI");

    b.classList.toggle("blue",!mode);
    b.setAttribute(
      "aria-pressed",
      mode?"true":"false"
    );
  }

  if(hint){
    hint.textContent=
      mode
        ?"Şimdi haritada parkın içine tıkla."
        :"Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
  }

  bindClick();

  if(!mode){
    clearCandidates();
    clear();
    return;
  }

  if(!getMap()){
    mode=false;setMode(mode);
    if(b){
      b.textContent="🌳 Park Analizi Modu: KAPALI";
      b.classList.add("blue");
      b.setAttribute("aria-pressed","false");
    }
    if(hint){
      hint.textContent=
        "Harita henüz hazır değil; tekrar deneyin.";
    }
    return;
  }

  notify(
    "🌳 Park Analizi modu açıldı. Haritada bir parkın içine tıklayın.",
    "ok",
    "🌳"
  );
}

 return toggleParkModeController;
 }
 root.DG_PARK_MODE_CONTROLLER_UI=Object.freeze({create});
})(window);
