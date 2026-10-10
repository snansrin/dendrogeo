"use strict";
/* Display a reference comparison without changing the measured park area. */
(function(root){
 function create({getElement,getReference,setReference,getPark,getAreaHa}){
  function set(value){
   const n=parseFloat(value);setReference(Number.isFinite(n)&&n>0?n:null);renderParkReferenceArea();
  }
function renderParkReferenceArea(){
  const el=getElement();
  const reference=getReference();
  if(!el) return;
  if(!(reference>0) || !getPark()){
    el.style.display="none";
    el.textContent="";
    return;
  }
  const ha=getAreaHa();
  if(!(ha>0)){
    el.style.display="none";
    el.textContent="";
    return;
  }
  const dev=Math.abs(((ha-reference)/reference)*100);
  el.style.display="inline-flex";
  el.textContent="Referans: "+reference.toFixed(2)+" ha · Sapma: %"+dev.toFixed(1);
  el.style.background=dev<3?"rgba(22,163,74,.12)":"rgba(245,158,11,.14)";
  el.style.color=dev<3?"#16a34a":"#b45309";
}

  return Object.freeze({set,render:renderParkReferenceArea});
 }
 root.DG_PARK_REFERENCE_AREA_UI=Object.freeze({create});
})(window);
