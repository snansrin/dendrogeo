"use strict";
/* Landing-only carousel: copy, animation and real-record captures travel together.
 * Native scroll snapping supplies touch gestures; this module owns navigation and accessibility. */
(function(root){
 function mount(element){
  if(!element||element.dataset.showcaseReady)return null;
  const track=element.querySelector('[data-showcase-track]'),panels=Array.from(element.querySelectorAll('[data-showcase-panel]')),buttons=Array.from(element.querySelectorAll('[data-showcase-index]')),status=element.querySelector('[data-showcase-status]');
  if(!track||!panels.length||buttons.length!==panels.length)return null;
  element.dataset.showcaseReady='true';let current=0,frame=0,requested=null;
  function fitHeight(){if(track.style&&panels[current]?.offsetHeight)track.style.height=Math.ceil(panels[current].offsetHeight)+'px';}
  function fieldLanguage(){if(!element.querySelectorAll)return;const translate=text=>typeof root.dgT==='function'?root.dgT(text):text;for(const label of element.querySelectorAll('.dg-tree-readouts [data-i18n]'))label.textContent=translate(label.dataset.i18n);const svg=element.querySelector('.hero-art svg');if(svg)svg.setAttribute('aria-label',translate('Örnek saha değerleri: çap 14,3 cm; tahmini karbon 40 kg C; ağaç boyu 13 m.'));}
  function update(index){
   current=Math.max(0,Math.min(panels.length-1,index));
   panels.forEach((panel,i)=>{panel.classList.toggle('is-active',i===current);panel.setAttribute('aria-hidden',String(i!==current));panel.inert=i!==current;});
   buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===current)));
   if(root.CustomEvent)element.dispatchEvent?.(new root.CustomEvent('dg:showcase-change',{detail:{index:current}}));
   const active=buttons[current],nav=active.parentElement;if(nav&&nav.scrollWidth>nav.clientWidth){const left=active.offsetLeft-nav.offsetLeft;if(left<nav.scrollLeft||left+active.offsetWidth>nav.scrollLeft+nav.clientWidth)nav.scrollTo({left:Math.max(0,left-nav.clientWidth/2+active.offsetWidth/2),behavior:'auto'});}
   if(status)status.textContent=String(current+1).padStart(2,'0')+' / '+String(panels.length).padStart(2,'0');
   fitHeight();
  }
  function go(index){const next=(index+panels.length)%panels.length;requested=next;update(next);track.scrollTo({left:next*track.clientWidth,behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  buttons.forEach((button,i)=>button.addEventListener('click',()=>go(i)));
  element.querySelector('[data-showcase-prev]')?.addEventListener('click',()=>go(current-1));
  element.querySelector('[data-showcase-next]')?.addEventListener('click',()=>go(current+1));
  for(const event of ['pointerdown','touchstart','wheel'])track.addEventListener(event,()=>{requested=null;},{passive:true});
  track.addEventListener('scroll',()=>{if(frame)return;frame=root.requestAnimationFrame(()=>{frame=0;if(!track.clientWidth)return;if(requested!==null&&Math.abs(track.scrollLeft-requested*track.clientWidth)>1)return;requested=null;update(Math.round(track.scrollLeft/track.clientWidth));});},{passive:true});
  element.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();go(event.key==='Home'?0:event.key==='End'?panels.length-1:current+(event.key==='ArrowLeft'?-1:1));buttons[current].focus({preventScroll:true});});
  root.addEventListener('resize',()=>{requested=null;track.scrollTo({left:current*track.clientWidth,behavior:'auto'});fitHeight();},{passive:true});
  if(root.ResizeObserver){const observer=new root.ResizeObserver(fitHeight);panels.forEach(panel=>observer.observe(panel));}
  root.addEventListener('dg:lang',()=>{fieldLanguage();fitHeight();});fieldLanguage();
  update(0);return Object.freeze({go,index:()=>current});
 }
 root.DG_LANDING_SHOWCASE=Object.freeze({mount});
 if(typeof document!=='undefined')document.querySelectorAll('[data-dg-showcase]').forEach(mount);
})(window);
