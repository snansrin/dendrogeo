"use strict";
(function(root){
 function schedule({window,document,load}){
  const element=document.getElementById("erisim");
  if(!element)return;
  if(!( "IntersectionObserver" in window)){window._tsVisible=true;load();return;}
  const observer=new window.IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){window._tsVisible=true;load();observer.disconnect();}
  },{rootMargin:"300px"});
  observer.observe(element);
 }
 function bindReady({document,schedule}){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});
  else schedule();
 }
 function initialize({window,api,tab,widgets,getElement,activateWidget}){
  if(!window._tsVisible||!api)return;
  const activeId=root.DG_TURNSTILE_FORM.resolve(tab);
  activateWidget({api,widgets,activeId,getElement});
 }
 root.DG_TURNSTILE_CONTROLLER=Object.freeze({schedule,bindReady,initialize});
})(window);
