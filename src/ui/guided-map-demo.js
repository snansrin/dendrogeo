"use strict";
/* Guided entry into the existing live map. All analysis remains user-triggered. */
(function(root){
 const copy={
  title:"Göksu Parkı · rehberli canlı harita",
  intro:"Gerçek harita ve OSM verisi kullanılır. Tarama geçici önizleme üretir; analiz ancak siz başlatırsınız, kalıcı karar için ayrıca Kabul et ve kaydet gerekir.",
  modeTitle:"1 · Park Analizi Modu",
  modeBody:"Önce harita araçlarındaki Park Analizi Modu düğmesine dokunun.",
  mapTitle:"2 · Göksu Parkı’nı seçin",
  mapBody:"Ok işareti parkın içini gösteriyor. Göksu Parkı sınırı içindeki bir noktaya dokunun; sınır OSM’den aranacaktır.",
  analyzeTitle:"3 · Yüzey analizini başlatın",
  analyzeBody:"Göksu Parkı bulundu. Haritadaki Yüzey Örtüsü Analizi düğmesine dokunarak gerçek raster ve OSM kanıtlarını getirin.",
  resultTitle:"4 · Sonucu inceleyin",
  resultBody:"Tarama başladı. Tamamlanma süresi parkın büyüklüğüne ve dış veri servislerinin yanıtına bağlıdır. Sonuç geldiğinde sınıf düğmeleri, OSM nesneleri, fırça, sınır araçları ve göreli NDVI’yı deneyin.",
  notFound:"Park henüz algılanmadı. Haritayı Göksu Parkı sınırı içinden seçip yeniden deneyin.",
  waitButton:"Park kartını veya yüzey analizi düğmesini bekliyor…",
  next:"Devam",
  close:"Turu kapat",
  return:"Ana sayfaya dön",
  progress:"Adım {step} / 4",
  guideLabel:"Rehberli harita turu",
  pageLabel:"Gerçek Göksu Parkı haritası"
 };
 let state=null;
 const translate=text=>typeof root.dgT==="function"?root.dgT(text):text;
 const textOf=node=>String(node?.innerText||node?.textContent||"").replace(/\s+/g," ").trim();
 function analysisButton(){return Array.from(document.querySelectorAll("#v-map button,#v-map [role='button']")).find(node=>/yüzey\s+örtüsü\s+analizi|surface\s+cover\s+analysis/i.test(textOf(node)))||null;}
 function parkDetected(){const card=document.getElementById("parkScanCard");return!!card&&!card.hidden&&root.getComputedStyle(card).display!=="none"&&/göksu\s+parkı|goksu\s+park/i.test(textOf(card));}
 function render(){
  if(!state)return;
  const {panel,step}=state,progress=translate(copy.progress).replace("{step}",String(step));
  const title=translate(step===1?copy.modeTitle:step===2?copy.mapTitle:step===3?copy.analyzeTitle:copy.resultTitle);
  const body=translate(step===1?copy.modeBody:step===2?copy.mapBody:step===3?copy.analyzeBody:copy.resultBody);
  panel.innerHTML=`<div class="dg-guided-demo-top"><div><p class="dg-guided-demo-kicker">${progress}</p><h3>${title}</h3></div><button type="button" class="btn sm ghost" data-tour-close>${translate(copy.close)}</button></div><p class="dg-guided-demo-copy">${body}</p><p class="dg-guided-demo-note">${translate(copy.intro)}</p><div class="dg-guided-demo-actions">${step===4?`<button type="button" class="btn sm ghost" data-tour-return>${translate(copy.return)}</button>`:`<span class="dg-guided-demo-wait" role="status">${translate(step===2?copy.notFound:copy.waitButton)}</span>`}<button type="button" class="btn sm ghost" data-tour-next ${step<4?"disabled":""}>${translate(copy.next)}</button></div></div>`;
  panel.hidden=false;
  document.querySelectorAll(".dg-guided-demo-focus").forEach(node=>node.classList.remove("dg-guided-demo-focus"));
  const target=step===1?document.getElementById("parkModeBtn"):step===2?document.getElementById("map"):step===3?analysisButton():null;
  if(target)target.classList.add("dg-guided-demo-focus");
  const wait=panel.querySelector(".dg-guided-demo-wait");if(wait&&step===2&&state.parkClickSeen)wait.textContent=translate(copy.notFound);
  if(wait&&step===3&&!analysisButton())wait.textContent=translate(copy.waitButton);
 }
 function stepTo(step){if(!state)return;state.step=step;render();}
 function scanForPark(){if(!state||state.step!==2)return;if(parkDetected()){stepTo(3);return;}if(state.parkClickSeen){const wait=state.panel.querySelector(".dg-guided-demo-wait");if(wait)wait.textContent=translate(copy.notFound);}}
 function onClick(event){if(!state)return;
  if(event.target.closest("[data-tour-close]")){stop(false);return;}
  if(event.target.closest("[data-tour-return]")){stop(true);return;}
  if(event.target.closest("[data-tour-next]")&&state.step===4){stop(false);return;}
  if(state.step===1&&event.target.closest("#parkModeBtn")){root.setTimeout(()=>{if(state?.step===1&&root.DG_GUIDED_MAP_DEMO_ADAPTER.create().parkMode())stepTo(2);},100);return;}
  if(state.step===2&&event.target.closest("#map")){state.parkClickSeen=true;root.setTimeout(scanForPark,450);return;}
  if(state.step===3&&analysisButton()&&event.target.closest("button,[role='button']")===analysisButton())root.setTimeout(()=>{if(state?.step===3)stepTo(4);},250);
 }
 function stop(returnLanding){if(!state)return;const current=state;state=null;current.observer?.disconnect();current.root.removeEventListener("click",onClick,true);document.querySelectorAll(".dg-guided-demo-focus").forEach(node=>node.classList.remove("dg-guided-demo-focus"));current.panel.remove();if(returnLanding){const landing=document.getElementById("landing"),shell=document.getElementById("shell");if(shell)shell.style.display="none";if(landing)landing.style.display="block";root.scrollTo({top:0,behavior:"instant"});}}
 function start(){
  if(state){state.panel.scrollIntoView({block:"nearest",behavior:"smooth"});return true;}
  const landing=document.getElementById("landing"),shell=document.getElementById("shell"),mapView=document.getElementById("v-map");
  if(!landing||!shell||!mapView||typeof root.go!=="function")return false;
  landing.style.display="none";shell.style.display="block";root.go("map");
  const panel=document.createElement("section");panel.className="dg-guided-demo";panel.setAttribute("aria-label",translate(copy.guideLabel));panel.setAttribute("role","region");
  const heading=mapView.querySelector("h2");if(heading)heading.insertAdjacentElement("afterend",panel);else mapView.prepend(panel);
  const current={panel,root:mapView,step:1,parkClickSeen:false,observer:null};state=current;render();
  current.root.addEventListener("click",onClick,true);
  current.observer=new MutationObserver(scanForPark);current.observer.observe(mapView,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["style","hidden"]});
  let attempts=0;const focus=()=>{if(!state||state!==current)return;const adapter=root.DG_GUIDED_MAP_DEMO_ADAPTER?.create();if(adapter?.focusGoksu())return;if(++attempts<20)root.setTimeout(focus,150);};root.setTimeout(focus,180);
  return true;
 }
 root.DG_GUIDED_MAP_DEMO=Object.freeze({start,stop:()=>stop(false)});
})(window);
