"use strict";
(function(root){
 const bindings=new WeakSet(),actionsByElement=new WeakMap();
 function bind(element,actions){if(!element||typeof element.addEventListener!=="function")return;actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);element.addEventListener("click",event=>{const button=event.target?.closest?.('[data-park-comparison-action="retry"]');if(button&&element.contains(button))actionsByElement.get(element)?.retry?.();});}
 function render({code,message,isAdmin,escape}){
  return `<div class="alert warn" style="margin-bottom:10px"><b>⚠ Park karşılaştırması yüklenemedi.</b> `+
   `Veritabanı şeması YERİNDE; sorun okuma yetkisi/oturum. `+
   `<span class="mono" style="font-size:.72rem">${escape(code)} ${escape(message)}</span><br>`+
   `<span style="font-size:.8rem">${isAdmin
    ?"Oturumu yenileyip (F5) tekrar deneyin. Hata sürerse Supabase → SQL Editor'da <span class='mono'>select * from v_park_compare limit 1;</span> sorgusunu kendi rolünüzle çalıştırın."
    :"Sayfayı yenileyin; sürerse yöneticiyle paylaşın."}</span> `+
   `<button class="btn sm" style="margin-left:6px" data-park-comparison-action="retry">↻ Yeniden dene</button></div>`;
 }
 root.DG_PARK_COMPARISON_ERROR_UI=Object.freeze({render,bind});
})(window);
