"use strict";
/* Landing-only guide over the saved Göksu scenes. It never starts the app map. */
(function(root){
 const copy={
  title:"Göksu Parkı · kayıtlı örnek",
  mapTitle:"1 · Park geometrisini inceleyin",
  mapBody:"Bu görünüm, Göksu Parkı için kaydedilmiş park sınırını gösterir. Sınıf düğmeleriyle harita geometrisini keşfedebilirsiniz.",
  analysisTitle:"2 · Kayıtlı yüzey analizini inceleyin",
  analysisBody:"Bu görünüm, Göksu Parkı’nın kabul edilmiş yüzey analizini ve sınıf alanlarını gösterir. Yeni tarama başlatılmaz ve hiçbir kayıt değiştirilmez.",
  note:"Tanıtım yalnızca sitede yayımlanan örnek kaydı kullanır; oturum açmaz, canlı harita veya dış veri servisi başlatmaz.",
  previous:"Önceki",
  next:"Kayıtlı analizi göster",
  finish:"Turu tamamla",
  close:"Turu kapat",
  progress:"Adım {step} / 2",
  label:"Göksu Parkı örnek turu"
 };
 let state=null;
 const translate=text=>typeof root.dgT==="function"?root.dgT(text):text;
 function render(){
  if(!state)return;
  const {panel,step}=state,second=step===2;
  panel.innerHTML=`<div class="dg-guided-demo-top"><div><p class="dg-guided-demo-kicker">${translate(copy.progress).replace("{step}",String(step))}</p><h3>${translate(second?copy.analysisTitle:copy.mapTitle)}</h3></div><button type="button" class="btn sm ghost" data-tour-close>${translate(copy.close)}</button></div><p class="dg-guided-demo-copy">${translate(second?copy.analysisBody:copy.mapBody)}</p><p class="dg-guided-demo-note">${translate(copy.note)}</p><div class="dg-guided-demo-actions">${second?`<button type="button" class="btn sm ghost" data-tour-previous>${translate(copy.previous)}</button>`:`<span aria-hidden="true"></span>`}<button type="button" class="btn sm" data-tour-next>${translate(second?copy.finish:copy.next)}</button></div>`;
 }
 function selectScene(index){return root.DG_GUIDED_MAP_DEMO_ADAPTER?.create().selectScene(index)===true;}
 function onClick(event){
  if(!state)return;
  if(event.target.closest("[data-tour-close]")){stop();return;}
  if(event.target.closest("[data-tour-previous]")){state.step=1;selectScene(1);render();return;}
  if(event.target.closest("[data-tour-next]")){
   if(state.step===1){if(!selectScene(2))return;state.step=2;render();return;}
   stop();
  }
 }
 function stop(){if(!state)return;const current=state;state=null;current.showcase.removeEventListener("click",onClick,true);current.panel.remove();current.launch?.focus({preventScroll:true});}
 function start(){
  if(state){state.panel.scrollIntoView({block:"nearest",behavior:"smooth"});return true;}
  const showcase=document.querySelector("[data-dg-showcase]"),controls=showcase?.querySelector(".dg-showcase-controls");
  if(!showcase||!controls||!selectScene(1))return false;
  const panel=document.createElement("section");panel.className="dg-guided-demo";panel.setAttribute("aria-label",translate(copy.label));panel.setAttribute("role","region");
  controls.insertAdjacentElement("afterend",panel);
  state={showcase,panel,step:1,launch:document.activeElement};
  render();showcase.addEventListener("click",onClick,true);panel.scrollIntoView({block:"nearest",behavior:"smooth"});
  panel.querySelector("[data-tour-close]")?.focus({preventScroll:true});
  return true;
 }
 root.DG_GUIDED_MAP_DEMO=Object.freeze({start,stop});
})(window);
